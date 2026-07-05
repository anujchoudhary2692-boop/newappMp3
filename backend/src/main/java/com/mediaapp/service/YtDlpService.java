package com.mediaapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

import java.io.BufferedReader;
import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class YtDlpService {

    private static final String USER_AGENT =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                    + "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

    /** Tried in order until one succeeds — helps on cloud vs local. */
    private static final String[] EXTRACTOR_PROFILES = {
            "youtube:player_client=ios,tv_embedded,mweb,web",
            "youtube:player_client=android,web",
            "youtube:player_client=tv_embedded,web",
            "youtube:player_client=web"
    };

    @Value("${app.media.yt-dlp-path:yt-dlp}")
    private String ytDlpPath;

    @Value("${app.media.youtube-cookies-file:}")
    private String youtubeCookiesFile;

    @Value("${app.media.youtube-cookies-base64:}")
    private String youtubeCookiesBase64;

    @Value("${app.storage.downloads-dir:./storage/downloads}")
    private String downloadsDir;

    @Value("${app.media.yt-dlp-timeout-seconds:600}")
    private int defaultTimeoutSeconds;

    private Path effectiveCookiesPath;
    private String version = "unknown";
    private boolean available;

    @PostConstruct
    void init() {
        initCookies();
        probeBinary();
    }

    private void initCookies() {
        try {
            Path downloadsPath = Path.of(downloadsDir).toAbsolutePath().normalize();
            Files.createDirectories(downloadsPath);

            if (youtubeCookiesBase64 != null && !youtubeCookiesBase64.isBlank()) {
                Path cookiesPath = downloadsPath.resolve(".youtube_cookies.txt");
                byte[] decoded = Base64.getDecoder().decode(youtubeCookiesBase64.trim());
                Files.write(cookiesPath, decoded);
                effectiveCookiesPath = cookiesPath;
                log.info("YouTube cookies loaded from env ({} bytes)", decoded.length);
            } else if (youtubeCookiesFile != null && !youtubeCookiesFile.isBlank()) {
                Path configured = Path.of(youtubeCookiesFile.trim());
                if (Files.isRegularFile(configured)) {
                    effectiveCookiesPath = configured.toAbsolutePath().normalize();
                    log.info("YouTube cookies file: {}", effectiveCookiesPath);
                } else {
                    log.warn("YouTube cookies file not found: {}", configured);
                }
            }
        } catch (Exception e) {
            log.warn("Could not initialize YouTube cookies: {}", e.getMessage());
        }
    }

    private void probeBinary() {
        try {
            Process process = new ProcessBuilder(ytDlpPath, "--version").start();
            if (process.waitFor(10, TimeUnit.SECONDS) && process.exitValue() == 0) {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                    version = reader.readLine();
                }
                available = true;
                log.info("yt-dlp ready: {}", version);
            } else {
                available = false;
                log.error("yt-dlp not available at {}", ytDlpPath);
            }
        } catch (Exception e) {
            available = false;
            log.error("yt-dlp probe failed: {}", e.getMessage());
        }
    }

    public boolean isAvailable() {
        return available;
    }

    public String getVersion() {
        return version;
    }

    public boolean hasCookies() {
        return effectiveCookiesPath != null && Files.isRegularFile(effectiveCookiesPath);
    }

    public String getUserAgent() {
        return USER_AGENT;
    }

    public String friendlyError(String raw) {
        if (raw == null || raw.isBlank()) {
            return "Media request failed. Try again.";
        }
        String lower = raw.toLowerCase();
        if (lower.contains("not a bot") || lower.contains("sign in to confirm")) {
            return "YouTube blocked this server. Try SoundCloud/Web search results instead, "
                    + "or set YOUTUBE_COOKIES_BASE64 on Render.";
        }
        if (lower.contains("timed out") || lower.contains("timeout")) {
            return "Media timed out. Retry, or use Mac backend on same Wi‑Fi.";
        }
        if (lower.contains("ffmpeg")) {
            return "Video needs ffmpeg on server. Cloud image includes ffmpeg — redeploy backend.";
        }
        if (raw.length() > 220) {
            return raw.substring(raw.length() - 220);
        }
        return raw;
    }

    public boolean isBotBlock(String output) {
        if (output == null) {
            return false;
        }
        String lower = output.toLowerCase();
        return lower.contains("not a bot") || lower.contains("sign in to confirm");
    }

    /** Flat search — minimal args, usually works even when full extract is blocked. */
    public RunResult runSearch(List<String> baseArgs, int timeoutSeconds)
            throws IOException, InterruptedException {
        List<String> cmd = new ArrayList<>(baseArgs);
        appendSearchArgs(cmd);
        return runOnce(cmd, timeoutSeconds);
    }

    /** Full extract/download — tries multiple YouTube client profiles. */
    public RunResult runWithFallbacks(String sourceUrl, List<String> trailingArgs, int timeoutSeconds)
            throws IOException, InterruptedException {
        String lastOutput = "";

        for (String profile : EXTRACTOR_PROFILES) {
            List<String> cmd = new ArrayList<>();
            cmd.add(ytDlpPath);
            appendExtractArgs(cmd, profile);
            cmd.add(sourceUrl);
            if (trailingArgs != null) {
                cmd.addAll(trailingArgs);
            }
            try {
                RunResult result = runOnce(cmd, timeoutSeconds);
                if (result.exitCode() == 0) {
                    return result;
                }
                lastOutput = result.output();
                if (isBotBlock(lastOutput)) {
                    log.debug("yt-dlp bot block with profile {}", profile);
                    continue;
                }
                log.debug("yt-dlp failed profile {}: exit {}", profile, result.exitCode());
            } catch (InterruptedException e) {
                throw e;
            }
        }

        throw new IllegalStateException(
                friendlyError(lastOutput.isBlank() ? "yt-dlp failed on all client profiles" : lastOutput));
    }

    public void pipeWithFallbacks(
            String sourceUrl,
            List<String> trailingArgs,
            java.io.OutputStream outputStream,
            int timeoutSeconds) throws IOException, InterruptedException {
        String lastOutput = "";

        for (String profile : EXTRACTOR_PROFILES) {
            List<String> cmd = new ArrayList<>();
            cmd.add(ytDlpPath);
            appendExtractArgs(cmd, profile);
            cmd.add(sourceUrl);
            if (trailingArgs != null) {
                cmd.addAll(trailingArgs);
            }

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            StringBuilder errOut = new StringBuilder();
            Thread drain = new Thread(() -> readOutput(process, errOut));
            drain.start();

            long[] bytesWritten = {0};
            OutputStream guarded = new FilterOutputStream(outputStream) {
                @Override
                public void write(byte[] b, int off, int len) throws IOException {
                    bytesWritten[0] += len;
                    super.write(b, off, len);
                }

                @Override
                public void write(int b) throws IOException {
                    bytesWritten[0] += 1;
                    super.write(b);
                }
            };

            try (var in = process.getInputStream()) {
                in.transferTo(guarded);
            }

            if (!process.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalStateException("Stream timed out after " + timeoutSeconds + "s");
            }
            drain.join(5000);

            if (process.exitValue() == 0) {
                return;
            }
            lastOutput = errOut.toString();
            if (bytesWritten[0] > 0) {
                throw new IllegalStateException(
                        friendlyError(lastOutput.isBlank() ? "Stream failed after partial output" : lastOutput));
            }
            if (isBotBlock(lastOutput)) {
                log.debug("Pipe bot block with profile {}", profile);
                continue;
            }
        }

        throw new IllegalStateException(
                friendlyError(lastOutput.isBlank() ? "Stream failed on all client profiles" : lastOutput));
    }

    public String resolveDirectUrl(String sourceUrl, MediaTypeArg type, int timeoutSeconds)
            throws IOException, InterruptedException {
        return resolveDirectUrl(sourceUrl, type, timeoutSeconds, EXTRACTOR_PROFILES, false, null);
    }

    public String resolveDirectUrl(String sourceUrl, MediaTypeArg type, int timeoutSeconds, String format)
            throws IOException, InterruptedException {
        return resolveDirectUrl(sourceUrl, type, timeoutSeconds, EXTRACTOR_PROFILES, false, format);
    }

    /** Fast path for playback — single iOS profile, no remote ejs fetch. */
    public String resolveDirectUrlFast(String sourceUrl, MediaTypeArg type, int timeoutSeconds)
            throws IOException, InterruptedException {
        return resolveDirectUrl(
                sourceUrl,
                type,
                timeoutSeconds,
                new String[] {EXTRACTOR_PROFILES[0]},
                true,
                null);
    }

    public String resolveDirectUrlFast(String sourceUrl, MediaTypeArg type, int timeoutSeconds, String format)
            throws IOException, InterruptedException {
        return resolveDirectUrl(
                sourceUrl,
                type,
                timeoutSeconds,
                new String[] {EXTRACTOR_PROFILES[0]},
                true,
                format);
    }

    private String resolveDirectUrl(
            String sourceUrl,
            MediaTypeArg type,
            int timeoutSeconds,
            String[] profiles)
            throws IOException, InterruptedException {
        return resolveDirectUrl(sourceUrl, type, timeoutSeconds, profiles, false, null);
    }

    private String resolveDirectUrl(
            String sourceUrl,
            MediaTypeArg type,
            int timeoutSeconds,
            String[] profiles,
            boolean fastExtract)
            throws IOException, InterruptedException {
        return resolveDirectUrl(sourceUrl, type, timeoutSeconds, profiles, fastExtract, null);
    }

    private String resolveDirectUrl(
            String sourceUrl,
            MediaTypeArg type,
            int timeoutSeconds,
            String[] profiles,
            boolean fastExtract,
            String formatOverride)
            throws IOException, InterruptedException {
        String format = formatOverride != null && !formatOverride.isBlank()
                ? formatOverride
                : type == MediaTypeArg.AUDIO
                    ? "140/bestaudio[ext=m4a]/bestaudio/best"
                    : "18/best[height<=480][ext=mp4][vcodec^=avc1]/best[ext=mp4]/best";

        for (String profile : profiles) {
            List<String> cmd = new ArrayList<>();
            cmd.add(ytDlpPath);
            cmd.add(sourceUrl);
            appendExtractArgs(cmd, profile, fastExtract);
            cmd.add("-g");
            cmd.add("-f");
            cmd.add(format);

            RunResult result = runOnce(cmd, timeoutSeconds);
            if (result.exitCode() == 0) {
                String url = result.output().lines()
                        .map(String::trim)
                        .filter(line -> line.startsWith("http"))
                        .findFirst()
                        .orElse(null);
                if (url != null && !url.isBlank()) {
                    return url;
                }
            }
            if (isBotBlock(result.output())) {
                log.debug("Direct URL bot block with profile {}", profile);
            }
        }
        throw new IllegalStateException("Could not resolve direct stream URL");
    }

    private void appendSearchArgs(List<String> cmd) {
        cmd.add("--no-playlist");
        cmd.add("--no-warnings");
        if (effectiveCookiesPath != null) {
            cmd.add("--cookies");
            cmd.add(effectiveCookiesPath.toString());
        }
    }

    private void appendExtractArgs(List<String> cmd, String extractorProfile) {
        appendExtractArgs(cmd, extractorProfile, false);
    }

    private void appendExtractArgs(List<String> cmd, String extractorProfile, boolean fastExtract) {
        cmd.add("--no-playlist");
        cmd.add("--no-warnings");
        cmd.add("--extractor-args");
        cmd.add(extractorProfile);
        if (!fastExtract) {
            cmd.add("--remote-components");
            cmd.add("ejs:github");
        }
        cmd.add("--user-agent");
        cmd.add(USER_AGENT);
        if (effectiveCookiesPath != null) {
            cmd.add("--cookies");
            cmd.add(effectiveCookiesPath.toString());
        }
    }

    public RunResult runOnce(List<String> command, int timeoutSeconds)
            throws IOException, InterruptedException {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        StringBuilder output = new StringBuilder();
        Thread drain = new Thread(() -> readOutput(process, output));
        drain.start();

        if (!process.waitFor(timeoutSeconds, TimeUnit.SECONDS)) {
            process.destroyForcibly();
            drain.join(3000);
            throw new IllegalStateException("yt-dlp timed out after " + timeoutSeconds + "s");
        }
        drain.join(5000);

        return new RunResult(process.exitValue(), output.toString());
    }

    private void readOutput(Process process, StringBuilder output) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                log.debug("yt-dlp: {}", line);
                if (output.length() < 8000) {
                    output.append(line).append('\n');
                }
            }
        } catch (IOException ignored) {
        }
    }

    public enum MediaTypeArg {
        AUDIO, VIDEO
    }

    public record RunResult(int exitCode, String output) {
        public String tail(int maxLen) {
            if (output == null || output.isBlank()) {
                return "";
            }
            String t = output.trim();
            return t.length() > maxLen ? t.substring(t.length() - maxLen) : t;
        }
    }
}
