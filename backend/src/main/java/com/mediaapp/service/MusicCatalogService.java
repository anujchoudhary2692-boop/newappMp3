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
 * Free/public media catalogs that work on cloud without YouTube cookies.
 *
 * <p>Primary: Internet Archive (archive.org) — no API key, direct MP3/MP4 download URLs.
 * Optional: Jamendo Creative Commons (needs JAMENDO_CLIENT_ID).
 * MusicBrainz is metadata-only and is not returned as playable (old SC search links failed prepare).
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

    @Value("${app.catalog.jamendo-enabled:true}")
    private boolean jamendoEnabled;

    @Value("${app.catalog.jamendo-client-id:}")
    private String jamendoClientId;

    public List<MediaSearchResultDto> searchCatalog(String query, int limit) {
        if (query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }
        List<MediaSearchResultDto> results = new ArrayList<>();

        if (archiveEnabled) {
            // Prefer playable audio first, then movies for video.
            results.addAll(searchInternetArchive(query, Math.max(3, limit / 2 + 1), "audio"));
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
                        item.getSource() != null ? item.getSource() : "Archive");
            }
        }
        return results.stream().limit(limit).toList();
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

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return null;
    }

    private record ArchiveFile(String url, boolean video, int rank, long size) {}
}
