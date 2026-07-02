package com.mediaapp.service;

import com.mediaapp.dto.PrepareStatusDto;
import com.mediaapp.model.MediaType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    private final MediaService mediaService;
    private final YtDlpService ytDlpService;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Map<String, PrepareStatusDto> jobs = new ConcurrentHashMap<>();
    private final Map<String, Long> jobStartedAt = new ConcurrentHashMap<>();

    @Value("${app.media.prepare-timeout-seconds:180}")
    private long prepareTimeoutSeconds;

    @Value("${RENDER:false}")
    private boolean renderHost;

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
                if (started != null && System.currentTimeMillis() - started < prepareTimeoutMs()) {
                    return withElapsedMessage(existing, started);
                }
                jobs.remove(key);
                jobStartedAt.remove(key);
                return failedDto(
                        videoId,
                        type,
                        renderHost && !ytDlpService.hasCookies()
                                ? "YouTube blocked cloud playback. Start Mac backend on same Wi‑Fi, or set YOUTUBE_COOKIES_BASE64 on Render."
                                : "Prepare timed out after " + prepareTimeoutSeconds + "s. Try again or use Mac backend on Wi‑Fi.");
            }
            if (existing.getStatus() == PrepareStatusDto.Status.FAILED) {
                jobs.remove(key);
                jobStartedAt.remove(key);
            }
        }

        if (!ytDlpService.isAvailable()) {
            return failedDto(videoId, type, "Media engine unavailable. Redeploy backend with yt-dlp.");
        }

        PrepareStatusDto preparing = PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.PREPARING)
                .contentType(mediaService.getStreamContentType(type))
                .quality(type == MediaType.AUDIO ? "Preparing audio…" : "Preparing video…")
                .message(prepareMessage(type))
                .build();
        jobs.put(key, preparing);
        jobStartedAt.put(key, System.currentTimeMillis());

        executor.submit(() -> runPrepare(key, videoId, type));
        return preparing;
    }

    private void runPrepare(String key, String videoId, MediaType type) {
        try {
            try {
                String directUrl = mediaService.resolveDirectUrlFastForClient(videoId, type);
                mediaService.warmCacheAsync(videoId, type);
                jobs.put(key, readyDirectDto(videoId, type, directUrl));
                return;
            } catch (Exception fastEx) {
                log.debug("Fast direct URL unavailable for {} {}: {}", videoId, type, fastEx.getMessage());
            }

            try {
                String directUrl = mediaService.resolveDirectUrlForClient(videoId, type);
                mediaService.warmCacheAsync(videoId, type);
                jobs.put(key, readyDirectDto(videoId, type, directUrl));
                return;
            } catch (Exception directEx) {
                log.info("Direct URL unavailable for {} {}, caching file: {}", videoId, type, directEx.getMessage());
            }

            if (renderHost && !ytDlpService.hasCookies()) {
                jobs.put(key, failedDto(
                        videoId,
                        type,
                        "YouTube blocked cloud playback. Start Mac backend on same Wi‑Fi, or set YOUTUBE_COOKIES_BASE64 on Render."));
                return;
            }

            Path cached = mediaService.ensureCachedPlaybackPublic(videoId, type);
            jobs.put(key, readyDto(videoId, type, cached, "Cached on server"));
        } catch (Exception e) {
            log.error("Prepare failed for {} {}", videoId, type, e);
            jobs.put(key, failedDto(videoId, type, mediaService.friendlyMediaError(e.getMessage())));
        } finally {
            jobStartedAt.remove(key);
        }
    }

    private PrepareStatusDto readyDirectDto(String videoId, MediaType type, String directUrl) {
        return PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.READY)
                .streamUrl(directUrl)
                .contentType(mediaService.getStreamContentType(type))
                .quality(type == MediaType.AUDIO ? "Streaming Audio" : "Streaming Video")
                .message("Direct stream")
                .build();
    }

    private PrepareStatusDto withElapsedMessage(PrepareStatusDto dto, long startedAt) {
        long elapsedSec = (System.currentTimeMillis() - startedAt) / 1000;
        return PrepareStatusDto.builder()
                .videoId(dto.getVideoId())
                .type(dto.getType())
                .status(dto.getStatus())
                .streamUrl(dto.getStreamUrl())
                .contentType(dto.getContentType())
                .quality(dto.getQuality())
                .message("Preparing… " + elapsedSec + "s (up to " + prepareTimeoutSeconds + "s)")
                .build();
    }

    private String prepareMessage(MediaType type) {
        String base = type == MediaType.AUDIO
                ? "Preparing audio for playback."
                : "Preparing video for playback.";
        if (!ytDlpService.hasCookies()) {
            return base + " Cloud may need YouTube cookies — or use Mac backend on Wi‑Fi.";
        }
        return base + " Usually 30–90 seconds.";
    }

    private PrepareStatusDto failedDto(String videoId, MediaType type, String message) {
        return PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.FAILED)
                .contentType(mediaService.getStreamContentType(type))
                .message(message)
                .build();
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

    private long prepareTimeoutMs() {
        return TimeUnit.SECONDS.toMillis(prepareTimeoutSeconds);
    }

    private static String jobKey(String videoId, MediaType type) {
        return videoId + ":" + type.name();
    }
}
