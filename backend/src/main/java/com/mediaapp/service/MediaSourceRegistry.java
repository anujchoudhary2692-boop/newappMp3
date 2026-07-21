package com.mediaapp.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class MediaSourceRegistry {

    private static final long TTL_SECONDS = 45 * 60;
    /** Direct catalog CDNs stay registered longer — play after search should not 502. */
    private static final long CATALOG_TTL_SECONDS = 6 * 60 * 60;

    private record Entry(String sourceUrl, String extractor, Instant expiresAt) {}

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();

    public void register(String mediaId, String sourceUrl, String extractor) {
        if (mediaId == null || mediaId.isBlank() || sourceUrl == null || sourceUrl.isBlank()) {
            return;
        }
        entries.put(mediaId, new Entry(sourceUrl, extractor, Instant.now().plusSeconds(ttlFor(sourceUrl))));
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
        entries.compute(mediaId, (id, existing) -> {
            if (existing != null && existing.expiresAt.isAfter(Instant.now())) {
                return existing;
            }
            return new Entry(sourceUrl, extractor, Instant.now().plusSeconds(ttlFor(sourceUrl)));
        });
    }

    private static long ttlFor(String sourceUrl) {
        String lower = sourceUrl.toLowerCase();
        if (lower.contains("storage.jamendo.com")
                || lower.contains("cdn.freesound.org")
                || lower.contains("ccmixter.org")
                || lower.contains("archive.org")
                || lower.endsWith(".mp3")
                || lower.contains("format=mp3")) {
            return CATALOG_TTL_SECONDS;
        }
        return TTL_SECONDS;
    }
}
