package com.mediaapp.service;

import com.mediaapp.dto.MediaSearchResultDto;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SearchCacheService {

    private static final long TTL_MS = 10 * 60 * 1000L;
    private static final int MAX_ENTRIES = 200;

    private record CacheEntry(List<MediaSearchResultDto> results, long expiresAt) {}

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public Optional<List<MediaSearchResultDto>> get(String query, int limit) {
        String key = cacheKey(query, limit);
        CacheEntry entry = cache.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (System.currentTimeMillis() > entry.expiresAt()) {
            cache.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.results());
    }

    public void put(String query, int limit, List<MediaSearchResultDto> results) {
        if (results == null || results.isEmpty()) {
            return;
        }
        evictIfNeeded();
        cache.put(cacheKey(query, limit), new CacheEntry(List.copyOf(results), System.currentTimeMillis() + TTL_MS));
    }

    private String cacheKey(String query, int limit) {
        return query.trim().toLowerCase(Locale.ROOT) + "|" + limit;
    }

    private void evictIfNeeded() {
        if (cache.size() < MAX_ENTRIES) {
            return;
        }
        long now = System.currentTimeMillis();
        cache.entrySet().removeIf(e -> now > e.getValue().expiresAt());
        if (cache.size() >= MAX_ENTRIES) {
            cache.clear();
        }
    }
}
