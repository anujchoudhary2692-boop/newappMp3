package com.mediaapp.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mediaapp.dto.MediaSearchResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Finds playable media via open-web search (DuckDuckGo) instead of YouTube-only search. */
@Slf4j
@Service
@RequiredArgsConstructor
public class WebSearchService {

    private static final Pattern UDDG = Pattern.compile("uddg=([^&\"]+)");
    private static final String USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    + "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    private final YtDlpService ytDlpService;
    private final ObjectMapper objectMapper;
    private final MediaSourceRegistry mediaSourceRegistry;

    @Value("${app.media.yt-dlp-path:yt-dlp}")
    private String ytDlpPath;

    @Value("${app.media.web-search-timeout-seconds:25}")
    private int probeTimeoutSeconds;

    public List<MediaSearchResultDto> searchMedia(String query, int limit) {
        if (query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }

        List<String> candidateUrls = discoverUrls(query.trim(), limit * 4);
        List<MediaSearchResultDto> results = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();

        for (String url : candidateUrls) {
            if (results.size() >= limit) {
                break;
            }
            if (!seen.add(url.toLowerCase(Locale.ROOT))) {
                continue;
            }
            try {
                parseUrlMetadata(url).ifPresent(results::add);
            } catch (Exception e) {
                log.debug("Web URL probe skipped {}: {}", url, e.getMessage());
            }
        }
        return results;
    }

    private List<String> discoverUrls(String query, int maxUrls) {
        Set<String> urls = new LinkedHashSet<>();
        String q = query + " song mp3 OR audio site:soundcloud.com OR site:archive.org OR site:bandcamp.com";
        collectFromDuckDuckGo(q, urls, maxUrls);
        if (urls.size() < maxUrls / 2) {
            collectFromDuckDuckGo(query + " official audio download", urls, maxUrls);
        }
        return new ArrayList<>(urls);
    }

    private void collectFromDuckDuckGo(String query, Set<String> urls, int maxUrls) {
        try {
            String body = fetchHtml("https://html.duckduckgo.com/html/?q=" + encodeQuery(query));
            Matcher matcher = UDDG.matcher(body);
            while (matcher.find() && urls.size() < maxUrls) {
                String decoded = URLDecoder.decode(matcher.group(1), StandardCharsets.UTF_8);
                if (isAllowedUrl(decoded)) {
                    urls.add(normalizeUrl(decoded));
                }
            }
        } catch (Exception e) {
            log.debug("DuckDuckGo search failed: {}", e.getMessage());
        }
    }

    private String fetchHtml(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(12000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
        conn.connect();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            return sb.toString();
        }
    }

    private boolean isAllowedUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("youtube.com") || lower.contains("youtu.be")) {
            return false;
        }
        if (lower.contains("google.com") || lower.contains("facebook.com") || lower.contains("instagram.com")) {
            return false;
        }
        if (lower.endsWith(".mp3") || lower.endsWith(".mp4") || lower.endsWith(".m4a") || lower.endsWith(".webm")) {
            return true;
        }
        return lower.contains("soundcloud.com")
                || lower.contains("archive.org")
                || lower.contains("bandcamp.com")
                || lower.contains("mixcloud.com")
                || lower.contains("audiomack.com")
                || lower.contains("gaana.com")
                || lower.contains("vimeo.com");
    }

    private String normalizeUrl(String url) {
        try {
            URI uri = URI.create(url.trim());
            return uri.toString();
        } catch (Exception e) {
            return url.trim();
        }
    }

    private java.util.Optional<MediaSearchResultDto> parseUrlMetadata(String sourceUrl)
            throws IOException, InterruptedException {
        List<String> cmd = List.of(ytDlpPath, "--dump-json", "--skip-download", sourceUrl);
        YtDlpService.RunResult result = ytDlpService.runOnce(cmd, probeTimeoutSeconds);
        if (result.exitCode() != 0 || result.output().isBlank()) {
            return java.util.Optional.empty();
        }

        JsonNode node = objectMapper.readTree(result.output());
        String title = node.path("title").asText(null);
        if (title == null || title.isBlank()) {
            return java.util.Optional.empty();
        }

        String extractor = node.path("extractor_key").asText("Web");
        String id = node.path("id").asText(null);
        String mediaId = id != null && !id.isBlank()
                ? formatMediaId(extractor, id)
                : urlMediaId(sourceUrl);
        String webpageUrl = node.path("webpage_url").asText(sourceUrl);
        String channel = node.path("uploader").asText(node.path("channel").asText(extractor));

        mediaSourceRegistry.register(mediaId, webpageUrl, extractor);

        return java.util.Optional.of(MediaSearchResultDto.builder()
                .videoId(mediaId)
                .title(title)
                .thumbnailUrl(resolveThumbnail(node))
                .channel(channel)
                .durationSeconds(node.path("duration").isNumber() ? node.path("duration").asInt() : null)
                .sourceUrl(webpageUrl)
                .source(formatSourceLabel(extractor))
                .build());
    }

    private String formatMediaId(String extractor, String id) {
        if ("Youtube".equalsIgnoreCase(extractor)) {
            return id;
        }
        String prefix = extractor.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        if (prefix.isBlank()) {
            prefix = "web";
        }
        return prefix + "_" + id;
    }

    private String urlMediaId(String url) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(url.getBytes(StandardCharsets.UTF_8));
            return "web_" + HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (Exception e) {
            return "web_" + Math.abs(url.hashCode());
        }
    }

    private String formatSourceLabel(String extractor) {
        if (extractor == null || extractor.isBlank()) {
            return "Web";
        }
        return extractor.replace('_', ' ');
    }

    private String resolveThumbnail(JsonNode node) {
        if (node.has("thumbnail")) {
            return node.path("thumbnail").asText("");
        }
        if (node.has("thumbnails") && node.path("thumbnails").isArray() && !node.path("thumbnails").isEmpty()) {
            return node.path("thumbnails").get(node.path("thumbnails").size() - 1).path("url").asText("");
        }
        return "";
    }

    private String encodeQuery(String query) {
        return java.net.URLEncoder.encode(query, StandardCharsets.UTF_8);
    }
}
