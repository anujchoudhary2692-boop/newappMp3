package com.mediaapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediaapp.dto.MediaSearchResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Free/public media catalogs that work on cloud without YouTube cookies or paid API keys.
 *
 * <p>No account needed:
 * <ul>
 *   <li>Openverse — Creative Commons audio (Jamendo/Freesound CDN streams; works from cloud)</li>
 *   <li>ccMixter — CC remix MP3s (proxy must send Referer)</li>
 *   <li>Internet Archive — optional; many /download URLs are blocked from datacenter IPs</li>
 * </ul>
 * Optional: Jamendo direct API (needs {@code JAMENDO_CLIENT_ID}); usually unnecessary when Openverse is on.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicCatalogService {

    private static final String USER_AGENT = "MediaFaceApp/1.0 (https://newappmp3.onrender.com)";

    private final ObjectMapper objectMapper;
    private final MediaSourceRegistry mediaSourceRegistry;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(12))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    @Value("${app.catalog.archive-enabled:true}")
    private boolean archiveEnabled;

    @Value("${app.catalog.openverse-enabled:true}")
    private boolean openverseEnabled;

    @Value("${app.catalog.ccmixter-enabled:true}")
    private boolean ccMixterEnabled;

    @Value("${app.catalog.jamendo-enabled:true}")
    private boolean jamendoEnabled;

    @Value("${app.catalog.jamendo-client-id:}")
    private String jamendoClientId;

    public List<MediaSearchResultDto> searchCatalog(String query, int limit) {
        if (query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }
        List<MediaSearchResultDto> results = new ArrayList<>();

        // Openverse first: anonymous CC audio with CDN streams that work from cloud IPs.
        // Internet Archive search works, but many /download URLs return 401/403 from datacenters.
        if (openverseEnabled) {
            results.addAll(searchOpenverse(query, Math.max(4, (limit * 2) / 3)));
        }

        if (ccMixterEnabled && results.size() < limit) {
            results.addAll(searchCcMixter(query, Math.min(4, limit - results.size())));
        }

        if (archiveEnabled && results.size() < limit) {
            results.addAll(searchInternetArchive(query, limit - results.size(), "audio"));
            if (results.size() < limit) {
                results.addAll(searchInternetArchive(query, limit - results.size(), "movies"));
            }
        }

        if (jamendoEnabled && results.size() < limit) {
            results.addAll(searchJamendo(query, limit - results.size()));
        }

        for (MediaSearchResultDto item : results) {
            if (item.getSourceUrl() != null && item.getVideoId() != null) {
                mediaSourceRegistry.registerIfAbsent(
                        item.getVideoId(),
                        item.getSourceUrl(),
                        item.getSource() != null ? item.getSource() : "Openverse");
            }
        }
        return results.stream().limit(limit).toList();
    }

    /** Creative Commons audio via Openverse — anonymous, no API key. */
    private List<MediaSearchResultDto> searchOpenverse(String query, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            String url = "https://api.openverse.org/v1/audio/?q=" + encoded
                    + "&page_size=" + Math.min(Math.max(limit, 5), 20)
                    + "&filter_dead=true";
            // Avoid extension=mp3 filter — Jamendo uses query URLs (?format=mp32), not .mp3 paths.
            JsonNode root = getJson(url);
            List<MediaSearchResultDto> out = new ArrayList<>();
            for (JsonNode track : root.path("results")) {
                if (out.size() >= limit) {
                    break;
                }
                String audio = track.path("url").asText(null);
                String id = track.path("id").asText("");
                String title = track.path("title").asText("");
                if (audio == null || audio.isBlank() || id.isBlank() || title.isBlank()) {
                    continue;
                }
                if (!looksPlayableAudioUrl(audio) || !isMobileFriendlyAudioUrl(audio)) {
                    continue;
                }
                String creator = firstNonBlank(
                        track.path("creator").asText(null),
                        track.path("source").asText(null),
                        "Openverse");
                Integer durationSec = null;
                if (track.path("duration").isNumber()) {
                    long ms = track.path("duration").asLong();
                    // Openverse returns milliseconds for most providers.
                    durationSec = ms > 10_000 ? (int) (ms / 1000) : (int) ms;
                }
                String thumb = track.path("thumbnail").asText("");
                String provider = track.path("source").asText("openverse");
                String mediaId = "ov_" + id.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
                out.add(MediaSearchResultDto.builder()
                        .videoId(mediaId)
                        .title(title)
                        .channel(creator)
                        .artist(creator)
                        .thumbnailUrl(thumb)
                        .durationSeconds(durationSec)
                        .sourceUrl(audio)
                        .source("Openverse")
                        .catalogSource("openverse:" + provider)
                        .hasVideo(false)
                        .build());
            }
            return out;
        } catch (Exception e) {
            log.debug("Openverse search failed: {}", e.getMessage());
            return List.of();
        }
    }

    /** ccMixter remix catalog — no API key, direct MP3 download URLs. */
    private List<MediaSearchResultDto> searchCcMixter(String query, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            String url = "https://ccmixter.org/api/query?f=json&limit="
                    + Math.min(Math.max(limit, 5), 20)
                    + "&search=" + encoded;
            JsonNode root = getJson(url);
            if (!root.isArray()) {
                return List.of();
            }
            List<MediaSearchResultDto> out = new ArrayList<>();
            for (JsonNode track : root) {
                if (out.size() >= limit) {
                    break;
                }
                String title = track.path("upload_name").asText("");
                String id = track.path("upload_id").asText("");
                if (title.isBlank() || id.isBlank()) {
                    continue;
                }
                String mp3 = pickCcMixterMp3(track.path("files"));
                if (mp3 == null) {
                    continue;
                }
                String artist = firstNonBlank(
                        track.path("user_real_name").asText(null),
                        track.path("user_name").asText(null),
                        "ccMixter");
                String mediaId = "ccm_" + id;
                out.add(MediaSearchResultDto.builder()
                        .videoId(mediaId)
                        .title(title)
                        .channel(artist)
                        .artist(artist)
                        .thumbnailUrl("")
                        .durationSeconds(null)
                        .sourceUrl(mp3)
                        .source("ccMixter")
                        .catalogSource("ccmixter")
                        .hasVideo(false)
                        .build());
            }
            return out;
        } catch (Exception e) {
            log.debug("ccMixter search failed: {}", e.getMessage());
            return List.of();
        }
    }

    private static String pickCcMixterMp3(JsonNode files) {
        if (files == null || !files.isArray()) {
            return null;
        }
        String fallback = null;
        for (JsonNode f : files) {
            String dl = f.path("download_url").asText(null);
            if (dl == null || dl.isBlank()) {
                continue;
            }
            String lower = dl.toLowerCase(Locale.ROOT);
            String mime = f.path("file_format_info").path("mime_type").asText("").toLowerCase(Locale.ROOT);
            if (lower.endsWith(".mp3") || mime.contains("mpeg") || mime.contains("mp3")) {
                return dl;
            }
            if (fallback == null && (lower.endsWith(".m4a") || lower.endsWith(".ogg") || lower.endsWith(".oga"))) {
                fallback = dl;
            }
        }
        return fallback;
    }

    private static boolean looksPlayableAudioUrl(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("storage.jamendo.com")
                || lower.contains("cdn.freesound.org")
                || lower.contains("ccmixter.org/content/")
                || lower.contains("upload.wikimedia.org")) {
            return true;
        }
        int q = lower.indexOf('?');
        String path = q >= 0 ? lower.substring(0, q) : lower;
        return path.endsWith(".mp3")
                || path.endsWith(".m4a")
                || path.endsWith(".aac")
                || path.endsWith(".ogg")
                || path.endsWith(".oga")
                || path.endsWith(".wav")
                || path.endsWith(".flac");
    }

    /** Formats that play reliably on iOS/Android without extra codecs. */
    private static boolean isMobileFriendlyAudioUrl(String url) {
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("storage.jamendo.com")
                || lower.contains("cdn.freesound.org")
                || lower.contains("ccmixter.org/content/")) {
            return true;
        }
        int q = lower.indexOf('?');
        String path = q >= 0 ? lower.substring(0, q) : lower;
        return path.endsWith(".mp3") || path.endsWith(".m4a") || path.endsWith(".aac");
    }

    private List<MediaSearchResultDto> searchJamendo(String query, int limit) {
        String clientId = jamendoClientId == null ? "" : jamendoClientId.trim();
        if (clientId.isBlank() || limit <= 0) {
            return List.of();
        }
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            String url = "https://api.jamendo.com/v3.0/tracks/?client_id=" + encodeQuery(clientId)
                    + "&format=json&limit=" + Math.min(limit, 15)
                    + "&search=" + encoded
                    + "&audioformat=mp32&include=musicinfo";
            JsonNode root = getJson(url);
            if (!"success".equalsIgnoreCase(root.path("headers").path("status").asText(""))) {
                log.debug("Jamendo search skipped: {}", root.path("headers").path("error_message").asText(""));
                return List.of();
            }
            List<MediaSearchResultDto> out = new ArrayList<>();
            for (JsonNode track : root.path("results")) {
                String audio = firstNonBlank(
                        track.path("audiodownload").asText(null),
                        track.path("audio").asText(null));
                String id = track.path("id").asText("");
                String title = track.path("name").asText("");
                if (audio == null || id.isBlank() || title.isBlank()) {
                    continue;
                }
                String artist = track.path("artist_name").asText("Jamendo");
                String mediaId = "jamendo_" + id;
                out.add(MediaSearchResultDto.builder()
                        .videoId(mediaId)
                        .title(title)
                        .channel(artist)
                        .artist(artist)
                        .album(track.path("album_name").asText(null))
                        .thumbnailUrl(track.path("image").asText(""))
                        .durationSeconds(track.path("duration").isNumber() ? track.path("duration").asInt() : null)
                        .sourceUrl(audio)
                        .source("Jamendo")
                        .catalogSource("jamendo")
                        .hasVideo(false)
                        .build());
            }
            return out;
        } catch (Exception e) {
            log.debug("Jamendo search failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<MediaSearchResultDto> searchInternetArchive(String query, int limit, String mediaType) {
        if (limit <= 0) {
            return List.of();
        }
        try {
            boolean wantVideo = "movies".equalsIgnoreCase(mediaType);
            String q = URLEncoder.encode(
                    "(" + query.trim() + ") AND mediatype:" + mediaType,
                    StandardCharsets.UTF_8);
            String searchUrl = "https://archive.org/advancedsearch.php?q=" + q
                    + "&fl[]=identifier,title,creator,mediatype"
                    + "&sort[]=downloads+desc"
                    + "&rows=" + Math.min(limit * 3, 24)
                    + "&output=json";
            JsonNode docs = getJson(searchUrl).path("response").path("docs");
            List<MediaSearchResultDto> out = new ArrayList<>();
            for (JsonNode doc : docs) {
                if (out.size() >= limit) {
                    break;
                }
                String identifier = doc.path("identifier").asText("");
                String title = doc.path("title").asText("");
                if (identifier.isBlank() || title.isBlank()) {
                    continue;
                }
                String creator = doc.path("creator").isArray() && !doc.path("creator").isEmpty()
                        ? doc.path("creator").get(0).asText("")
                        : doc.path("creator").asText("");

                Optional<ArchiveFile> file = resolveArchivePlayableFile(identifier, wantVideo);
                if (file.isEmpty()) {
                    continue;
                }
                ArchiveFile playable = file.get();
                String mediaId = "ia_" + identifier.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "_");
                out.add(MediaSearchResultDto.builder()
                        .videoId(mediaId)
                        .title(title)
                        .channel(creator.isBlank() ? "Internet Archive" : creator)
                        .artist(creator)
                        .thumbnailUrl("https://archive.org/services/img/" + identifier)
                        .durationSeconds(null)
                        .sourceUrl(playable.url())
                        .source("Internet Archive")
                        .catalogSource("archive")
                        .hasVideo(wantVideo || playable.video())
                        .build());
            }
            return out;
        } catch (Exception e) {
            log.debug("Internet Archive {} search failed: {}", mediaType, e.getMessage());
            return List.of();
        }
    }

    private Optional<ArchiveFile> resolveArchivePlayableFile(String identifier, boolean preferVideo) {
        try {
            JsonNode meta = getJson("https://archive.org/metadata/" + encodePath(identifier));
            JsonNode files = meta.path("files");
            if (!files.isArray()) {
                return Optional.empty();
            }
            List<ArchiveFile> candidates = new ArrayList<>();
            for (JsonNode f : files) {
                String name = f.path("name").asText("");
                String format = f.path("format").asText("").toLowerCase(Locale.ROOT);
                String lowerName = name.toLowerCase(Locale.ROOT);
                if (name.isBlank()) {
                    continue;
                }
                boolean mp3 = format.contains("mp3") || lowerName.endsWith(".mp3");
                boolean m4a = format.contains("m4a") || lowerName.endsWith(".m4a") || lowerName.endsWith(".aac");
                boolean ogg = format.contains("ogg") || lowerName.endsWith(".ogg") || lowerName.endsWith(".oga");
                boolean mp4 = format.contains("mpeg4") || format.contains("h.264") || format.equals("mp4")
                        || lowerName.endsWith(".mp4") || lowerName.endsWith(".m4v");
                boolean webm = lowerName.endsWith(".webm");
                // Skip derivatives we don't want when originals exist (prefer VBR MP3 / 512Kb MPEG4).
                if (preferVideo) {
                    if (!(mp4 || webm)) {
                        continue;
                    }
                } else {
                    if (!(mp3 || m4a || ogg)) {
                        continue;
                    }
                }
                long size = f.path("size").asLong(0);
                int rank = preferVideo
                        ? (mp4 ? 0 : 2)
                        : (format.contains("vbr mp3") ? 0 : mp3 ? 1 : m4a ? 2 : 3);
                String url = "https://archive.org/download/" + identifier + "/"
                        + URLEncoder.encode(name, StandardCharsets.UTF_8).replace("+", "%20");
                candidates.add(new ArchiveFile(url, preferVideo || mp4 || webm, rank, size));
            }
            return candidates.stream()
                    .sorted(Comparator
                            .comparingInt(ArchiveFile::rank)
                            .thenComparing(Comparator.comparingLong(ArchiveFile::size).reversed()))
                    .findFirst();
        } catch (Exception e) {
            log.debug("Archive metadata failed for {}: {}", identifier, e.getMessage());
            return Optional.empty();
        }
    }

    private JsonNode getJson(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(18))
                .header("User-Agent", USER_AGENT)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 300) {
            throw new IllegalStateException("HTTP " + response.statusCode());
        }
        return objectMapper.readTree(response.body());
    }

    private static String encodeQuery(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private record ArchiveFile(String url, boolean video, int rank, long size) {}
}
