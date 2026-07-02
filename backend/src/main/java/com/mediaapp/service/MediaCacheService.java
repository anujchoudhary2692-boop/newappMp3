package com.mediaapp.service;

import com.mediaapp.dto.PrepareStatusDto;
import com.mediaapp.model.MediaType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class MediaCacheService {

    private static final long PREPARE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(4);

    private final MediaService mediaService;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, PrepareStatusDto> jobs = new ConcurrentHashMap<>();
    private final Map<String, Long> jobStartedAt = new ConcurrentHashMap<>();

    public PrepareStatusDto prepare(String videoId, MediaType type) {
        String key = jobKey(videoId, type);

        try {
            Path cached = mediaService.cachePathFor(videoId, type);
            if (Files.exists(cached) && Files.size(cached) > 0
                    && (type != MediaType.VIDEO || mediaService.isCachedVideoPlayable(cached))) {
                return readyDto(videoId, type, cached, null);
            }
        } catch (Exception e) {
            log.debug("Cache check failed for {} {}: {}", videoId, type, e.getMessage());
        }

        PrepareStatusDto existing = jobs.get(key);
        if (existing != null) {
            if (existing.getStatus() == PrepareStatusDto.Status.READY && existing.getStreamUrl() != null) {
                return existing;
            }
            if (existing.getStatus() == PrepareStatusDto.Status.PREPARING) {
                Long started = jobStartedAt.get(key);
                if (started != null && System.currentTimeMillis() - started < PREPARE_TIMEOUT_MS) {
                    return existing;
                }
                jobs.remove(key);
                jobStartedAt.remove(key);
            }
            if (existing.getStatus() == PrepareStatusDto.Status.FAILED) {
                jobs.remove(key);
                jobStartedAt.remove(key);
            }
        }

        PrepareStatusDto preparing = PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.PREPARING)
                .contentType(mediaService.getStreamContentType(type))
                .quality(type == MediaType.AUDIO ? "Preparing audio…" : "Preparing video…")
                .message("Downloading for playback. This may take 1–2 minutes on cloud.")
                .build();
        jobs.put(key, preparing);
        jobStartedAt.put(key, System.currentTimeMillis());

        executor.submit(() -> runPrepare(key, videoId, type));
        return preparing;
    }

    private void runPrepare(String key, String videoId, MediaType type) {
        try {
            try {
                String directUrl = mediaService.resolveDirectUrlForClient(videoId, type);
                mediaService.warmCacheAsync(videoId, type);
                jobs.put(key, PrepareStatusDto.builder()
                        .videoId(videoId)
                        .type(type)
                        .status(PrepareStatusDto.Status.READY)
                        .streamUrl(directUrl)
                        .contentType(mediaService.getStreamContentType(type))
                        .quality(type == MediaType.AUDIO ? "Streaming Audio" : "Streaming Video")
                        .message("Direct stream")
                        .build());
                return;
            } catch (Exception directEx) {
                log.info("Direct URL unavailable for {} {}, caching file: {}", videoId, type, directEx.getMessage());
            }

            Path cached = mediaService.ensureCachedPlaybackPublic(videoId, type);
            jobs.put(key, readyDto(videoId, type, cached, "Cached on server"));
        } catch (Exception e) {
            log.error("Prepare failed for {} {}", videoId, type, e);
            jobStartedAt.remove(key);
            jobs.put(key, PrepareStatusDto.builder()
                    .videoId(videoId)
                    .type(type)
                    .status(PrepareStatusDto.Status.FAILED)
                    .contentType(mediaService.getStreamContentType(type))
                    .message(mediaService.friendlyMediaError(e.getMessage()))
                    .build());
        }
    }

    private PrepareStatusDto readyDto(String videoId, MediaType type, Path cached, String message) {
        return PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.READY)
                .streamUrl("/files/cache/" + cached.getFileName())
                .contentType(type == MediaType.AUDIO ? "audio/mp4" : "video/mp4")
                .quality(type == MediaType.AUDIO ? "Cached Audio" : mediaService.videoQualityLabelPublic())
                .message(message)
                .build();
    }

    private static String jobKey(String videoId, MediaType type) {
        return videoId + ":" + type.name();
    }
}
