package com.mediaapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediaapp.dto.MediaSearchResultDto;
import com.mediaapp.dto.PlayUrlDto;
import com.mediaapp.dto.StreamInfoDto;
import com.mediaapp.model.MediaItem;
import com.mediaapp.model.MediaType;
import com.mediaapp.repository.MediaItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import com.mediaapp.util.RangeFileResponse;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaService {

    private final MediaItemRepository mediaItemRepository;
    private final ObjectMapper objectMapper;
    private final Path downloadsPath;

    private final Map<String, Object> downloadLocks = new ConcurrentHashMap<>();
    private final Map<String, DirectUrlEntry> directUrlCache = new ConcurrentHashMap<>();

    private record DirectUrlEntry(String url, Instant expiresAt) {}

    private static final String YT_EXTRACTOR_ARGS =
            "youtube:player_client=ios,tv_embedded,mweb,web";
    private static final String YT_USER_AGENT =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                    + "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    @Value("${app.media.yt-dlp-path:yt-dlp}")
    private String ytDlpPath;

    @Value("${app.media.youtube-cookies-file:}")
    private String youtubeCookiesFile;

    @Value("${app.media.youtube-cookies-base64:}")
    private String youtubeCookiesBase64;

    private Path effectiveCookiesPath;

    @PostConstruct
    void initYoutubeCookies() {
        try {
            if (youtubeCookiesBase64 != null && !youtubeCookiesBase64.isBlank()) {
                Path cookiesPath = downloadsPath.resolve(".youtube_cookies.txt");
                byte[] decoded = Base64.getDecoder().decode(youtubeCookiesBase64.trim());
                Files.write(cookiesPath, decoded);
                effectiveCookiesPath = cookiesPath.toAbsolutePath().normalize();
                log.info("YouTube cookies loaded from env ({} bytes)", decoded.length);
            } else if (youtubeCookiesFile != null && !youtubeCookiesFile.isBlank()) {
                Path configured = Path.of(youtubeCookiesFile.trim());
                if (Files.isRegularFile(configured)) {
                    effectiveCookiesPath = configured.toAbsolutePath().normalize();
                    log.info("YouTube cookies file configured: {}", effectiveCookiesPath);
                } else {
                    log.warn("YouTube cookies file not found: {}", configured);
                }
            }
        } catch (Exception e) {
            log.warn("Could not initialize YouTube cookies: {}", e.getMessage());
        }
    }

    public String friendlyMediaError(String raw) {
        if (raw == null || raw.isBlank()) {
            return "Media request failed. Try again.";
        }
        String lower = raw.toLowerCase();
        if (lower.contains("not a bot") || lower.contains("sign in to confirm")) {
            return "YouTube blocked this server. Add YOUTUBE_COOKIES_BASE64 on Render, "
                    + "or use your Mac backend on the same Wi‑Fi.";
        }
        if (lower.contains("timed out")) {
            return "Media timed out. Cloud may be slow — retry or use Mac backend on Wi‑Fi.";
        }
        if (raw.length() > 220) {
            return raw.substring(raw.length() - 220);
        }
        return raw;
    }

    private void appendYtDlpBaseArgs(List<String> cmd) {
        cmd.add("--no-playlist");
        cmd.add("--no-warnings");
        cmd.add("--extractor-args");
        cmd.add(YT_EXTRACTOR_ARGS);
        cmd.add("--remote-components");
        cmd.add("ejs:github");
        if (effectiveCookiesPath != null) {
            cmd.add("--cookies");
            cmd.add(effectiveCookiesPath.toString());
        }
    }

    public List<MediaSearchResultDto> search(String query, int limit) {
        if (query == null || query.isBlank()) {
            return List.of();
        }

        try {
            ProcessBuilder pb = new ProcessBuilder(
                    ytDlpPath,
                    "ytsearch" + Math.min(limit, 20) + ":" + query.trim(),
                    "--dump-json",
                    "--skip-download",
                    "--flat-playlist"
            );
            appendYtDlpBaseArgs(pb.command());
            pb.redirectErrorStream(true);
            Process process = pb.start();

            List<MediaSearchResultDto> results = new ArrayList<>();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    parseSearchLine(line).ifPresent(results::add);
                }
            }

            if (!process.waitFor(60, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException("Search timed out. Ensure yt-dlp is installed.");
            }
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Search failed. Check yt-dlp and network.");
            }

            return results.stream()
                    .limit(limit)
                    .map(this::enrichWithStreamUrls)
                    .collect(Collectors.toList());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Search interrupted");
        } catch (IOException e) {
            log.error("Search failed", e);
            throw new IllegalStateException("Search failed. Install yt-dlp: brew install yt-dlp");
        }
    }

    private MediaSearchResultDto enrichWithStreamUrls(MediaSearchResultDto result) {
        result.setAudioFormat("MP3 / M4A");
        result.setVideoFormat("MP4 / HD");
        result.setAudioStreamUrl("/api/media/stream/" + result.getVideoId() + "?type=AUDIO");
        result.setVideoStreamUrl("/api/media/stream/" + result.getVideoId() + "?type=VIDEO");
        return result;
    }

    public Optional<ResponseEntity<Resource>> tryServeCachedStream(
            String videoId, MediaType type, String rangeHeader) throws IOException {
        Path cached = cachePath(videoId, type);
        if (!Files.exists(cached) || Files.size(cached) == 0) {
            return Optional.empty();
        }
        if (type == MediaType.VIDEO && !isValidMp4(cached)) {
            Files.deleteIfExists(cached);
            return Optional.empty();
        }
        return Optional.of(RangeFileResponse.serve(cached, getStreamContentType(type), rangeHeader));
    }

    public Optional<ResponseEntity<Resource>> tryServeDirectStream(
            String videoId, MediaType type, String rangeHeader) {
        try {
            String directUrl = resolveDirectUrl(videoId, type);
            warmCacheAsync(videoId, type);
            return Optional.of(proxyHttpStream(directUrl, rangeHeader, getStreamContentType(type)));
        } catch (Exception e) {
            log.debug("Direct stream unavailable for {} {}: {}", videoId, type, e.getMessage());
            return Optional.empty();
        }
    }

    public void writeStreamPipe(String videoId, MediaType type, java.io.OutputStream outputStream)
            throws IOException, InterruptedException {
        pipeFromYtDlp(buildSourceUrl(videoId), type, outputStream);
        warmCacheAsync(videoId, type);
    }

    public void warmCacheAsync(String videoId, MediaType type) {
        new Thread(() -> {
            try {
                ensureCachedPlayback(videoId, type);
            } catch (Exception e) {
                log.debug("Background cache skipped for {} {}: {}", videoId, type, e.getMessage());
            }
        }).start();
    }

    public void writeStream(String videoId, MediaType type, java.io.OutputStream outputStream)
            throws IOException, InterruptedException {
        Path cached = cachePath(videoId, type);
        if (Files.exists(cached) && Files.size(cached) > 0) {
            if (type == MediaType.VIDEO && !isValidMp4(cached)) {
                Files.deleteIfExists(cached);
            } else {
                Files.copy(cached, outputStream);
                return;
            }
        }

        try {
            String directUrl = resolveDirectUrl(videoId, type);
            HttpURLConnection conn = openDirectConnection(directUrl, null);
            try (InputStream in = conn.getInputStream()) {
                in.transferTo(outputStream);
            }
            warmCacheAsync(videoId, type);
            return;
        } catch (Exception e) {
            log.debug("Direct pipe failed, using yt-dlp stdout: {}", e.getMessage());
        }

        writeStreamPipe(videoId, type, outputStream);
    }

    private Path cachePath(String videoId, MediaType type) {
        String ext = type == MediaType.AUDIO ? ".m4a" : ".mp4";
        return downloadsPath.resolve("cache").resolve(videoId + "_" + type.name().toLowerCase() + ext);
    }

    public Path cachePathFor(String videoId, MediaType type) {
        return cachePath(videoId, type);
    }

    public boolean isCachedVideoPlayable(Path path) {
        return isValidMp4(path);
    }

    public String resolveDirectUrlForClient(String videoId, MediaType type)
            throws IOException, InterruptedException {
        return resolveDirectUrl(videoId, type);
    }

    public String videoQualityLabelPublic() {
        return videoQualityLabel();
    }

    private String resolveDirectUrl(String videoId, MediaType type)
            throws IOException, InterruptedException {
        String key = videoId + ":" + type.name();
        DirectUrlEntry cached = directUrlCache.get(key);
        if (cached != null && cached.expiresAt.isAfter(Instant.now())) {
            return cached.url;
        }

        Object lock = downloadLocks.computeIfAbsent("url:" + key, k -> new Object());
        synchronized (lock) {
            cached = directUrlCache.get(key);
            if (cached != null && cached.expiresAt.isAfter(Instant.now())) {
                return cached.url;
            }

            List<String> cmd = new ArrayList<>();
            cmd.add(ytDlpPath);
            cmd.add(buildSourceUrl(videoId));
            appendYtDlpBaseArgs(cmd);
            cmd.add("-g");
            if (type == MediaType.AUDIO) {
                cmd.add("-f");
                cmd.add("140/bestaudio[ext=m4a]/bestaudio/best");
            } else {
                cmd.add("-f");
                cmd.add("18/best[height<=480][ext=mp4][vcodec^=avc1]/best[ext=mp4]/best");
            }

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            String url;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                url = reader.lines()
                        .map(String::trim)
                        .filter(line -> line.startsWith("http"))
                        .findFirst()
                        .orElse(null);
            }

            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException("Direct URL lookup timed out");
            }
            if (process.exitValue() != 0 || url == null || url.isBlank()) {
                throw new IllegalStateException("Could not resolve direct stream URL");
            }

            directUrlCache.put(key, new DirectUrlEntry(url, Instant.now().plus(Duration.ofMinutes(45))));
            return url;
        }
    }

    private ResponseEntity<Resource> proxyHttpStream(
            String directUrl, String rangeHeader, String contentType) throws IOException {
        HttpURLConnection conn = openDirectConnection(directUrl, rangeHeader);
        int code = conn.getResponseCode();
        HttpStatus status = code == HttpStatus.PARTIAL_CONTENT.value()
                ? HttpStatus.PARTIAL_CONTENT
                : HttpStatus.OK;

        InputStream bodyStream = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
        if (bodyStream == null) {
            throw new IOException("Empty response from media host");
        }

        ResponseEntity.BodyBuilder builder = ResponseEntity.status(status)
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CACHE_CONTROL, "no-cache");

        long contentLength = conn.getContentLengthLong();
        if (contentLength >= 0) {
            builder.header(HttpHeaders.CONTENT_LENGTH, String.valueOf(contentLength));
        }
        String contentRange = conn.getHeaderField(HttpHeaders.CONTENT_RANGE);
        if (contentRange != null) {
            builder.header(HttpHeaders.CONTENT_RANGE, contentRange);
        }

        return builder.body(new InputStreamResource(bodyStream));
    }

    private HttpURLConnection openDirectConnection(String directUrl, String rangeHeader) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(directUrl).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(120000);
        conn.setRequestProperty(HttpHeaders.USER_AGENT, YT_USER_AGENT);
        conn.setRequestProperty(HttpHeaders.ACCEPT, "*/*");
        conn.setRequestProperty(HttpHeaders.CONNECTION, "keep-alive");
        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            conn.setRequestProperty(HttpHeaders.RANGE, rangeHeader);
        }
        conn.connect();
        return conn;
    }

    public PlayUrlDto preparePlayback(String videoId, MediaType type) {
        try {
            Path cached = cachePath(videoId, type);

            if (Files.exists(cached) && Files.size(cached) > 0
                    && (type != MediaType.VIDEO || isValidMp4(cached))) {
                return PlayUrlDto.builder()
                        .videoId(videoId)
                        .type(type)
                        .streamUrl("/files/cache/" + cached.getFileName())
                        .contentType(type == MediaType.AUDIO ? "audio/mp4" : "video/mp4")
                        .quality(type == MediaType.AUDIO ? "Cached Audio" : videoQualityLabel())
                        .cached(true)
                        .build();
            }

            try {
                String directUrl = resolveDirectUrl(videoId, type);
                warmCacheAsync(videoId, type);
                return PlayUrlDto.builder()
                        .videoId(videoId)
                        .type(type)
                        .streamUrl(directUrl)
                        .contentType(getStreamContentType(type))
                        .quality(type == MediaType.AUDIO ? "Streaming Audio" : "Streaming Video")
                        .cached(false)
                        .build();
            } catch (Exception directEx) {
                log.warn("Direct CDN URL unavailable for {} {}: {}", videoId, type, directEx.getMessage());
            }

            return PlayUrlDto.builder()
                    .videoId(videoId)
                    .type(type)
                    .streamUrl("/api/media/prepare/" + videoId + "?type=" + type)
                    .contentType(getStreamContentType(type))
                    .quality(type == MediaType.AUDIO ? "Preparing audio…" : "Preparing video…")
                    .cached(false)
                    .build();
        } catch (Exception e) {
            log.error("Playback prepare failed for {} {}", videoId, type, e);
            throw new IllegalStateException("Could not prepare playback. Try again.");
        }
    }

    private void pipeFromYtDlp(String sourceUrl, MediaType type, java.io.OutputStream outputStream)
            throws IOException, InterruptedException {
        List<String> cmd = new ArrayList<>();
        cmd.add(ytDlpPath);
        cmd.add(sourceUrl);
        appendYtDlpBaseArgs(cmd);
        cmd.add("-o");
        cmd.add("-");
        if (type == MediaType.AUDIO) {
            // Format 140 = ~128kbps m4a — starts much faster than bestaudio
            cmd.add("-f");
            cmd.add("140/bestaudio[ext=m4a]/bestaudio/best");
        } else {
            cmd.add("-f");
            cmd.add("18/best[height<=480][ext=mp4][vcodec^=avc1]/best[ext=mp4]/best");
        }

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(false);
        Process process = pb.start();

        Thread drainErr = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("yt-dlp pipe: {}", line);
                }
            } catch (IOException ignored) {
            }
        });
        drainErr.start();

        try (var in = process.getInputStream()) {
            in.transferTo(outputStream);
        }

        if (!process.waitFor(300, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IllegalStateException("Stream timed out");
        }
        drainErr.join(5000);

        if (process.exitValue() != 0) {
            throw new IllegalStateException("Stream failed. Check yt-dlp and network.");
        }
    }

    public Path ensureCachedPlaybackPublic(String videoId, MediaType type)
            throws IOException, InterruptedException {
        return ensureCachedPlayback(videoId, type);
    }

    private Path ensureCachedPlayback(String videoId, MediaType type)
            throws IOException, InterruptedException {
        Path cacheDir = downloadsPath.resolve("cache");
        Files.createDirectories(cacheDir);
        Path cached = cachePath(videoId, type);

        if (Files.exists(cached) && Files.size(cached) > 0) {
            if (type == MediaType.VIDEO && !isValidMp4(cached)) {
                log.warn("Removing invalid video cache (not MP4): {}", cached);
                Files.deleteIfExists(cached);
            } else {
                return cached;
            }
        }

        String lockKey = videoId + ":" + type;
        Object lock = downloadLocks.computeIfAbsent(lockKey, k -> new Object());
        synchronized (lock) {
            if (Files.exists(cached) && Files.size(cached) > 0) {
                if (type == MediaType.VIDEO && !isValidMp4(cached)) {
                    Files.deleteIfExists(cached);
                } else {
                    return cached;
                }
            }
            downloadToFile(buildSourceUrl(videoId), type, cached, true);
            return cached;
        }
    }

    public StreamInfoDto getStreamInfo(String sourceUrl) throws IOException, InterruptedException {
        List<String> cmd = new ArrayList<>();
        cmd.add(ytDlpPath);
        cmd.add("-J");
        cmd.add(sourceUrl);
        appendYtDlpBaseArgs(cmd);
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        String json;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            json = reader.lines().collect(Collectors.joining("\n"));
        }

        if (!process.waitFor(45, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IllegalStateException("Failed to read stream info");
        }
        if (process.exitValue() != 0) {
            throw new IllegalStateException("Could not read media info from source");
        }

        JsonNode node = objectMapper.readTree(json);
        String videoId = node.path("id").asText();

        return StreamInfoDto.builder()
                .videoId(videoId)
                .title(node.path("title").asText("Unknown"))
                .sourceUrl(sourceUrl)
                .audioFormat("M4A / MP3")
                .videoFormat("MP4")
                .audioQuality("Best Audio")
                .videoQuality("Best Video")
                .audioStreamUrl("/api/media/stream/" + videoId + "?type=AUDIO")
                .videoStreamUrl("/api/media/stream/" + videoId + "?type=VIDEO")
                .build();
    }

    public String getStreamContentType(MediaType type) {
        return type == MediaType.AUDIO ? "audio/mp4" : "video/mp4";
    }

    public MediaItem download(String videoId, String title, String sourceUrl, MediaType type) {
        String lockKey = "dl:" + videoId + ":" + type;
        Object lock = downloadLocks.computeIfAbsent(lockKey, k -> new Object());
        synchronized (lock) {
            if (mediaItemRepository.existsBySourceIdAndType(videoId, type)) {
                return mediaItemRepository.findBySourceIdAndType(videoId, type).orElseThrow();
            }

            try {
                Path targetDir = downloadsPath.resolve(type == MediaType.AUDIO ? "audio" : "video");
                Files.createDirectories(targetDir);
                String safeTitle = sanitize(title);
                Path outputPath = downloadLibraryFile(sourceUrl, type, targetDir, safeTitle, videoId);

                MediaItem item = MediaItem.builder()
                        .title(title)
                        .sourceUrl(sourceUrl)
                        .sourceId(videoId)
                        .type(type)
                        .fileName(outputPath.getFileName().toString())
                        .filePath(outputPath.toString())
                        .thumbnailUrl("https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg")
                        .fileSizeBytes(Files.size(outputPath))
                        .quality(type == MediaType.AUDIO
                                ? (outputPath.getFileName().toString().endsWith(".mp3") ? "MP3" : "M4A Audio")
                                : videoQualityLabel())
                        .downloadedAt(Instant.now())
                        .build();

                return mediaItemRepository.save(item);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Download interrupted");
            } catch (IOException e) {
                log.error("Download failed", e);
                throw new IllegalStateException("Download failed: " + e.getMessage());
            }
        }
    }

    private Path downloadLibraryFile(String sourceUrl, MediaType type, Path targetDir,
                                     String safeTitle, String videoId)
            throws IOException, InterruptedException {
        if (type == MediaType.AUDIO) {
            if (isFfmpegAvailable()) {
                try {
                    String template = targetDir.resolve(safeTitle + "_" + videoId + ".%(ext)s").toString();
                    List<String> mp3Cmd = new ArrayList<>();
                    mp3Cmd.add(ytDlpPath);
                    mp3Cmd.add(sourceUrl);
                    appendYtDlpBaseArgs(mp3Cmd);
                    mp3Cmd.addAll(List.of(
                            "-f", "bestaudio/best", "-x", "--audio-format", "mp3",
                            "--audio-quality", "0", "-o", template
                    ));
                    runYtDlp(mp3Cmd);
                    return findFileWithExtension(targetDir, videoId, ".mp3");
                } catch (Exception e) {
                    log.warn("MP3 download failed, using M4A: {}", e.getMessage());
                }
            }
            Path m4a = targetDir.resolve(safeTitle + "_" + videoId + ".m4a");
            List<String> m4aCmd = new ArrayList<>();
            m4aCmd.add(ytDlpPath);
            m4aCmd.add(sourceUrl);
            appendYtDlpBaseArgs(m4aCmd);
            m4aCmd.addAll(List.of(
                    "-f", "bestaudio[ext=m4a]/bestaudio/best",
                    "-o", m4a.toString()
            ));
            runYtDlp(m4aCmd);
            return m4a;
        }

        Path output = targetDir.resolve(safeTitle + "_" + videoId + ".mp4");
        runYtDlp(buildVideoDownloadCommand(sourceUrl, output.toString()));
        validatePlayableVideo(output);
        return output;
    }

    private String videoQualityLabel() {
        return isFfmpegAvailable() ? "HD Video (720p)" : "Video (360p MP4)";
    }

    private List<String> buildVideoDownloadCommand(String sourceUrl, String outputPath) {
        List<String> command = new ArrayList<>();
        command.add(ytDlpPath);
        command.add(sourceUrl);
        appendYtDlpBaseArgs(command);
        if (isFfmpegAvailable()) {
            command.add("-f");
            command.add("bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[ext=mp4]/best");
            command.add("--merge-output-format");
            command.add("mp4");
        } else {
            // Progressive MP4 only — avoids HLS/MPEG-TS files that mobile players cannot play
            command.add("-f");
            command.add("22/18/best[height<=480][ext=mp4][vcodec^=avc1][acodec^=mp4a]/18");
        }
        command.add("-o");
        command.add(outputPath);
        return command;
    }

    private void validatePlayableVideo(Path path) throws IOException {
        if (!Files.exists(path) || Files.size(path) == 0) {
            throw new IllegalStateException("Downloaded video missing or empty");
        }
        if (!isValidMp4(path)) {
            Files.deleteIfExists(path);
            throw new IllegalStateException(
                    "Video format not supported on device. Install ffmpeg for HD: brew install ffmpeg");
        }
    }

    private boolean isValidMp4(Path path) {
        try {
            byte[] header = new byte[12];
            try (var in = Files.newInputStream(path)) {
                if (in.read(header) < 8) {
                    return false;
                }
            }
            return header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p';
        } catch (IOException e) {
            return false;
        }
    }

    private boolean isFfmpegAvailable() {
        try {
            Process process = new ProcessBuilder("ffmpeg", "-version").start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private Path findFileWithExtension(Path dir, String videoId, String ext) throws IOException {
        try (var stream = Files.list(dir)) {
            return stream
                    .filter(p -> p.getFileName().toString().contains(videoId))
                    .filter(p -> p.getFileName().toString().endsWith(ext))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Downloaded file not found"));
        }
    }

    private void downloadToFile(String sourceUrl, MediaType type, Path outputPath, boolean forPlayback)
            throws IOException, InterruptedException {
        Files.createDirectories(outputPath.getParent());

        if (type == MediaType.AUDIO) {
            List<String> audioCmd = new ArrayList<>();
            audioCmd.add(ytDlpPath);
            audioCmd.add(sourceUrl);
            appendYtDlpBaseArgs(audioCmd);
            audioCmd.addAll(List.of(
                    "-f", "140/bestaudio[ext=m4a]/bestaudio/best",
                    "-o", outputPath.toString()
            ));
            runYtDlp(audioCmd);
        } else {
            runYtDlp(buildVideoDownloadCommand(sourceUrl, outputPath.toString()));
            validatePlayableVideo(outputPath);
        }

        if (!Files.exists(outputPath) || Files.size(outputPath) == 0) {
            throw new IllegalStateException("Downloaded file missing or empty");
        }
    }

    private void runYtDlp(List<String> command) throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        Thread drain = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("yt-dlp: {}", line);
                    if (output.length() < 4000) {
                        output.append(line).append('\n');
                    }
                }
            } catch (IOException ignored) {
            }
        });
        drain.start();

        if (!process.waitFor(600, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IllegalStateException("Download timed out after 10 minutes");
        }
        drain.join(5000);

        if (process.exitValue() != 0) {
            String tail = output.toString().trim();
            if (tail.length() > 200) {
                tail = tail.substring(tail.length() - 200);
            }
            throw new IllegalStateException(
                    tail.isBlank()
                            ? "yt-dlp failed. Install ffmpeg: brew install ffmpeg"
                            : friendlyMediaError("yt-dlp failed: " + tail)
            );
        }
    }

    private String buildSourceUrl(String videoId) {
        return "https://www.youtube.com/watch?v=" + videoId;
    }

    private Optional<MediaSearchResultDto> parseSearchLine(String line) {
        try {
            JsonNode node = objectMapper.readTree(line);
            String id = node.path("id").asText(null);
            if (id == null || id.isBlank()) {
                return Optional.empty();
            }
            return Optional.of(MediaSearchResultDto.builder()
                    .videoId(id)
                    .title(node.path("title").asText("Unknown"))
                    .thumbnailUrl(resolveThumbnail(node))
                    .channel(node.path("uploader").asText(node.path("channel").asText("Unknown")))
                    .durationSeconds(node.path("duration").isNumber() ? node.path("duration").asInt() : null)
                    .sourceUrl(buildSourceUrl(id))
                    .build());
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private String resolveThumbnail(JsonNode node) {
        if (node.has("thumbnail")) {
            return node.path("thumbnail").asText();
        }
        if (node.has("thumbnails") && node.path("thumbnails").isArray() && !node.path("thumbnails").isEmpty()) {
            return node.path("thumbnails").get(node.path("thumbnails").size() - 1).path("url").asText();
        }
        String id = node.path("id").asText("");
        return "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
    }

    public List<MediaItem> listByType(MediaType type) {
        return mediaItemRepository.findByTypeOrderByDownloadedAtDesc(type);
    }

    public void delete(String id) throws IOException {
        MediaItem item = mediaItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Media not found"));
        Path file = Path.of(item.getFilePath());
        if (Files.exists(file)) {
            Files.delete(file);
        }
        mediaItemRepository.delete(item);
    }

    private String sanitize(String input) {
        String cleaned = input.replaceAll("[^a-zA-Z0-9._-]", "_");
        return cleaned.length() > 60 ? cleaned.substring(0, 60) : cleaned;
    }
}
