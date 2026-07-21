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

/** Finds playable media via Google (preferred) and DuckDuckGo open-web search. */
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

    @Value("${app.media.google-api-key:}")
    private String googleApiKey;

    @Value("${app.media.google-cse-id:}")
    private String googleCseId;

    @Value("${RENDER:false}")
    private boolean renderHost;

    public List<MediaSearchResultDto> searchMedia(String query, int limit) {
        if (query == null || query.isBlank() || limit <= 0) {
            return List.of();
        }

        List<String> candidateUrls = discoverUrls(query.trim(), Math.min(limit * 3, 12));
        List<MediaSearchResultDto> results = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        // Cap yt-dlp probes — each can take many seconds on cloud.
        int maxProbes = Math.min(candidateUrls.size(), Math.max(limit + 2, 6));
        int probed = 0;

        for (String url : candidateUrls) {
            if (results.size() >= limit || probed >= maxProbes) {
                break;
            }
            if (!seen.add(url.toLowerCase(Locale.ROOT))) {
                continue;
            }
            probed++;
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
        String mediaQuery = query + " song OR audio OR mp3 OR official audio";

        // Prefer Google Custom Search API (reliable on cloud). HTML scrape is best-effort only.
        collectFromGoogleCse(mediaQuery, urls, maxUrls);
        if (urls.size() < Math.max(3, maxUrls / 2)) {
            collectFromGoogleHtml(
                    mediaQuery + " site:soundcloud.com OR site:archive.org OR site:youtube.com OR site:bandcamp.com",
                    urls,
                    maxUrls);
        }
        if (urls.size() < Math.max(3, maxUrls / 2)) {
            collectFromDuckDuckGo(
                    query + " song mp3 OR audio site:soundcloud.com OR site:archive.org OR site:bandcamp.com",
                    urls,
                    maxUrls);
        }
        if (urls.size() < 3) {
            collectFromDuckDuckGo(query + " official audio", urls, maxUrls);
        }
        return new ArrayList<>(urls);
    }

    /** Official Google Programmable Search — set GOOGLE_API_KEY + GOOGLE_CSE_ID on Render. */
    private void collectFromGoogleCse(String query, Set<String> urls, int maxUrls) {
        if (googleApiKey == null || googleApiKey.isBlank()
                || googleCseId == null || googleCseId.isBlank()) {
            return;
        }
        try {
            String endpoint = "https://www.googleapis.com/customsearch/v1?key="
                    + encodeQuery(googleApiKey.trim())
                    + "&cx=" + encodeQuery(googleCseId.trim())
                    + "&q=" + encodeQuery(query)
                    + "&num=" + Math.min(10, Math.max(1, maxUrls));
            String body = fetchBody(endpoint, "application/json");
            JsonNode root = objectMapper.readTree(body);
            if (root.has("error")) {
                log.warn("Google CSE error: {}", root.path("error").path("message").asText("unknown"));
                return;
            }
            JsonNode items = root.path("items");
            if (!items.isArray()) {
                return;
            }
            int before = urls.size();
            for (JsonNode item : items) {
                if (urls.size() >= maxUrls) {
                    break;
                }
                String link = item.path("link").asText(null);
                if (link != null && isAllowedUrl(link)) {
                    urls.add(normalizeUrl(link));
                }
            }
            int added = urls.size() - before;
            if (added > 0) {
                log.info("Google CSE added {} candidate URLs", added);
            }
        } catch (Exception e) {
            log.warn("Google CSE search failed: {}", e.getMessage());
        }
    }

    /** Best-effort Google HTML results (no API key). Often empty on datacenter IPs. */
    private void collectFromGoogleHtml(String query, Set<String> urls, int maxUrls) {
        try {
            // gbv=1 = basic HTML results (easier to parse than JS-heavy SERP)
            String endpoint = "https://www.google.com/search?gbv=1&hl=en&gl=us&pws=0&num=20&q="
                    + encodeQuery(query);
            String body = fetchBody(endpoint, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            int before = urls.size();
            // Classic redirect links: /url?q=https://...
            Matcher redirect = Pattern.compile("/url\\?q=(https?[^&\"']+)").matcher(body);
            while (redirect.find() && urls.size() < maxUrls) {
                String decoded = URLDecoder.decode(redirect.group(1), StandardCharsets.UTF_8);
                if (isAllowedUrl(decoded)) {
                    urls.add(normalizeUrl(decoded));
                }
            }
            // Bare https links in organic results
            Matcher href = Pattern.compile(
                    "href=\"(https?://(?!www\\.google\\.|maps\\.google\\.|accounts\\.google\\.|support\\.google\\.|policies\\.google\\.)[^\"]+)\""
            ).matcher(body);
            while (href.find() && urls.size() < maxUrls) {
                String link = href.group(1);
                if (isAllowedUrl(link)) {
                    urls.add(normalizeUrl(link));
                }
            }
            int added = urls.size() - before;
            if (added > 0) {
                log.info("Google HTML added {} candidate URLs", added);
            }
        } catch (Exception e) {
            log.debug("Google HTML search failed: {}", e.getMessage());
        }
    }

    private void collectFromDuckDuckGo(String query, Set<String> urls, int maxUrls) {
        try {
            String body = fetchBody(
                    "https://html.duckduckgo.com/html/?q=" + encodeQuery(query),
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
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

    private String fetchBody(String url, String accept) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("User-Agent", USER_AGENT);
        conn.setRequestProperty("Accept", accept);
        conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
        if (url.contains("google.com/search")) {
            conn.setRequestProperty("Referer", "https://www.google.com/");
        }
        conn.connect();
        int code = conn.getResponseCode();
        InputStreamReader streamReader = new InputStreamReader(
                code >= 400 && conn.getErrorStream() != null ? conn.getErrorStream() : conn.getInputStream(),
                StandardCharsets.UTF_8);
        try (BufferedReader reader = new BufferedReader(streamReader)) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            if (code >= 400) {
                throw new IOException("HTTP " + code + " for " + url);
            }
            return sb.toString();
        }
    }

    private boolean isAllowedUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        if (lower.contains("google.") || lower.contains("facebook.com") || lower.contains("instagram.com")
                || lower.contains("webcache.googleusercontent") || lower.contains("gstatic.com")
                || lower.contains("schema.org") || lower.contains("w3.org")) {
            return false;
        }
        // Allow YouTube when cookies exist (cloud) or always on Mac/LAN — Google often finds the best watch URLs.
        if (lower.contains("youtube.com") || lower.contains("youtu.be") || lower.contains("music.youtube.com")) {
            return ytDlpService.hasCookies() || !renderHost;
        }
        if (lower.endsWith(".mp3") || lower.endsWith(".mp4") || lower.endsWith(".m4a") || lower.endsWith(".webm")) {
            return true;
        }
        return lower.contains("soundcloud.com")
                || lower.contains("archive.org")
                || lower.contains("jamendo.com")
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
                .hasVideo(MediaService.hasVideoTrack(node, extractor))
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
