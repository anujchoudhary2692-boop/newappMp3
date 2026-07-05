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
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
@RequiredArgsConstructor
public class MusicCatalogService {

    private static final String USER_AGENT = "MediaFaceApp/1.0 (https://newappmp3.onrender.com)";

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(12))
            .build();

    @Value("${app.catalog.musicbrainz-enabled:true}")
    private boolean musicBrainzEnabled;

    @Value("${app.catalog.archive-enabled:true}")
    private boolean archiveEnabled;

    public List<MediaSearchResultDto> searchCatalog(String query, int limit) {
        if (query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }
        List<MediaSearchResultDto> results = new ArrayList<>();
        if (musicBrainzEnabled) {
            results.addAll(searchMusicBrainz(query, limit));
        }
        if (archiveEnabled && results.size() < limit) {
            results.addAll(searchInternetArchive(query, limit - results.size()));
        }
        return results.stream().limit(limit).toList();
    }

    private List<MediaSearchResultDto> searchMusicBrainz(String query, int limit) {
        try {
            String encoded = URLEncoder.encode(query.trim(), StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://musicbrainz.org/ws/2/recording?query="
                            + encoded + "&fmt=json&limit=" + limit))
                    .timeout(Duration.ofSeconds(15))
                    .header("User-Agent", USER_AGENT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                return List.of();
            }
            JsonNode recordings = objectMapper.readTree(response.body()).path("recordings");
            List<MediaSearchResultDto> out = new ArrayList<>();
            for (JsonNode rec : recordings) {
                String title = rec.path("title").asText("");
                if (title.isBlank()) {
                    continue;
                }
                String artist = rec.path("artist-credit").isArray() && rec.path("artist-credit").size() > 0
                        ? rec.path("artist-credit").get(0).path("name").asText("")
                        : "";
                String mbid = rec.path("id").asText("");
                int durationMs = rec.path("length").asInt(0);
                Integer durationSec = durationMs > 0 ? durationMs / 1000 : null;
                String searchQuery = (artist + " " + title).trim();
                String sourceUrl = "https://soundcloud.com/search/sounds?q="
                        + URLEncoder.encode(searchQuery, StandardCharsets.UTF_8);
                out.add(MediaSearchResultDto.builder()
                        .videoId("mb-" + mbid)
                        .title(title)
                        .channel(artist)
                        .artist(artist)
                        .album(rec.path("releases").isArray() && rec.path("releases").size() > 0
                                ? rec.path("releases").get(0).path("title").asText("")
                                : null)
                        .durationSeconds(durationSec)
                        .sourceUrl(sourceUrl)
                        .source("MusicBrainz")
                        .catalogSource("musicbrainz")
                        .hasVideo(false)
                        .build());
            }
            return out;
        } catch (Exception e) {
            log.debug("MusicBrainz search failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<MediaSearchResultDto> searchInternetArchive(String query, int limit) {
        try {
            String q = URLEncoder.encode(query.trim() + " AND mediatype:audio", StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://archive.org/advancedsearch.php?q=" + q
                            + "&fl[]=identifier,title,creator&rows=" + limit + "&output=json"))
                    .timeout(Duration.ofSeconds(15))
                    .header("User-Agent", USER_AGENT)
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 300) {
                return List.of();
            }
            JsonNode docs = objectMapper.readTree(response.body()).path("response").path("docs");
            List<MediaSearchResultDto> out = new ArrayList<>();
            for (JsonNode doc : docs) {
                String identifier = doc.path("identifier").asText("");
                String title = doc.path("title").asText("");
                if (identifier.isBlank() || title.isBlank()) {
                    continue;
                }
                String creator = doc.path("creator").isArray()
                        ? doc.path("creator").get(0).asText("")
                        : doc.path("creator").asText("");
                String sourceUrl = "https://archive.org/details/" + identifier;
                out.add(MediaSearchResultDto.builder()
                        .videoId("ia-" + identifier.toLowerCase(Locale.ROOT))
                        .title(title)
                        .channel(creator)
                        .artist(creator)
                        .sourceUrl(sourceUrl)
                        .source("Internet Archive")
                        .catalogSource("archive")
                        .hasVideo(false)
                        .build());
            }
            return out;
        } catch (Exception e) {
            log.debug("Internet Archive search failed: {}", e.getMessage());
            return List.of();
        }
    }
}
