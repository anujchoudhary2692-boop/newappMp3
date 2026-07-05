package com.mediaapp.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MediaSourceRegistry {

    private static final long TTL_SECONDS = 45 * 60;

    private record Entry(String sourceUrl, String extractor, Instant expiresAt) {}

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    public void register(String mediaId, String sourceUrl, String extractor) {
        if (mediaId == null || mediaId.isBlank() || sourceUrl == null || sourceUrl.isBlank()) {
            return;
        }
        entries.put(mediaId, new Entry(sourceUrl, extractor, Instant.now().plusSeconds(TTL_SECONDS)));
    }

    public Optional<String> getSourceUrl(String mediaId) {
        Entry entry = entries.get(mediaId);
        if (entry == null) {
            return Optional.empty();
        }
        if (entry.expiresAt.isBefore(Instant.now())) {
            entries.remove(mediaId);
            return Optional.empty();
        }
        return Optional.of(entry.sourceUrl);
    }

    public void registerIfAbsent(String mediaId, String sourceUrl, String extractor) {
        if (mediaId == null || mediaId.isBlank() || sourceUrl == null || sourceUrl.isBlank()) {
            return;
        }
        entries.computeIfAbsent(
                mediaId,
                id -> new Entry(sourceUrl, extractor, Instant.now().plusSeconds(TTL_SECONDS)));
    }
}
