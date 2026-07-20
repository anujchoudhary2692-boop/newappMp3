package com.mediaapp.service;

import com.mediaapp.dto.PrepareStatusDto;
import com.mediaapp.model.MediaType;
import com.mediaapp.util.MediaQualityPresets;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
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
    private final FaceScanService faceScanService;
    private final Map<String, PrepareStatusDto> jobs = new ConcurrentHashMap<>();
    private final Map<String, Long> jobStartedAt = new ConcurrentHashMap<>();
    private ExecutorService executor;

    @Value("${app.media.prepare-timeout-seconds:180}")
    private long prepareTimeoutSeconds;

    @Value("${app.media.prepare-max-concurrent:4}")
    private int prepareMaxConcurrent;

    @Value("${RENDER:false}")
    private boolean renderHost;

    @PostConstruct
    void initExecutor() {
        int threads = Math.max(1, prepareMaxConcurrent);
        executor = Executors.newFixedThreadPool(threads);
        log.info("Prepare executor: {} concurrent job(s)", threads);
    }

    @PreDestroy
    void shutdownExecutor() {
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    public PrepareStatusDto prepare(String videoId, MediaType type) {
        return prepare(videoId, type, null);
    }

    public PrepareStatusDto prepare(String videoId, MediaType type, String quality) {
        String preset = MediaQualityPresets.normalize(type, quality);
        String key = jobKey(videoId, type, preset);

        try {
            Path cached = mediaService.cachePathFor(videoId, type);
            if (Files.exists(cached) && Files.size(cached) > 0
                    && (type != MediaType.VIDEO || mediaService.isCachedVideoPlayable(cached))) {
                if (type == MediaType.VIDEO) {
                    queueVideoFaceScan(videoId);
                }
                return readyDto(videoId, type, cached, null, preset);
            }
        } catch (Exception e) {
            log.debug("Cache check failed for {} {}: {}", videoId, type, e.getMessage());
        }

        if (renderHost && !ytDlpService.hasCookies() && mediaService.isYouTubeMedia(videoId)) {
            return failedDto(videoId, type, cloudCookiesRequiredMessage());
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

        String qualityLabel = type == MediaType.AUDIO
                ? MediaQualityPresets.audioLabel(preset)
                : MediaQualityPresets.videoLabel(preset);

        PrepareStatusDto preparing = PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.PREPARING)
                .contentType(mediaService.getStreamContentType(type))
                .quality("Preparing · " + qualityLabel)
                .message(prepareMessage(type))
                .build();
        jobs.put(key, preparing);
        jobStartedAt.put(key, System.currentTimeMillis());

        executor.submit(() -> runPrepare(key, videoId, type, preset));
        return preparing;
    }

    private void runPrepare(String key, String videoId, MediaType type, String qualityPreset) {
        try {
            // Prefer direct URL / proxy on cloud too — full download before READY makes first play very slow
            // on Render free tier (ephemeral disk + cold start). Cache warms in the background.
            try {
                String directUrl = mediaService.resolveDirectUrlFastForClient(videoId, type, qualityPreset);
                mediaService.warmCacheAsync(videoId, type);
                jobs.put(key, readyDirectDto(videoId, type, directUrl, qualityPreset));
                if (type == MediaType.VIDEO) {
                    queueVideoFaceScan(videoId);
                }
                return;
            } catch (Exception fastEx) {
                log.debug("Fast direct URL unavailable for {} {}: {}", videoId, type, fastEx.getMessage());
            }

            try {
                String directUrl = mediaService.resolveDirectUrlForClient(videoId, type, qualityPreset);
                mediaService.warmCacheAsync(videoId, type);
                jobs.put(key, readyDirectDto(videoId, type, directUrl, qualityPreset));
                if (type == MediaType.VIDEO) {
                    queueVideoFaceScan(videoId);
                }
                return;
            } catch (Exception directEx) {
                log.info("Direct URL unavailable for {} {}: {}", videoId, type, directEx.getMessage());
            }

            if (renderHost && !ytDlpService.hasCookies() && mediaService.isYouTubeMedia(videoId)) {
                jobs.put(key, failedDto(
                        videoId,
                        type,
                        cloudCookiesRequiredMessage()));
                return;
            }

            // Stream via server proxy immediately; optionally finish a disk cache in background.
            mediaService.warmCacheAsync(videoId, type);
            jobs.put(key, readyProxyDto(videoId, type, qualityPreset));
            if (type == MediaType.VIDEO) {
                queueVideoFaceScan(videoId);
            }
        } catch (Exception e) {
            log.error("Prepare failed for {} {}", videoId, type, e);
            // Last resort on cloud: try full cache download so play can still work.
            if (renderHost) {
                try {
                    Path cached = mediaService.ensureCachedPlaybackPublic(videoId, type);
                    jobs.put(key, readyDto(videoId, type, cached, "Ready on cloud", qualityPreset));
                    if (type == MediaType.VIDEO) {
                        queueVideoFaceScan(videoId);
                    }
                    return;
                } catch (Exception cacheEx) {
                    log.error("Cloud cache prepare failed for {} {}: {}", videoId, type, cacheEx.getMessage());
                    jobs.put(key, failedDto(videoId, type, mediaService.friendlyMediaError(cacheEx.getMessage())));
                    return;
                }
            }
            jobs.put(key, failedDto(videoId, type, mediaService.friendlyMediaError(e.getMessage())));
        } finally {
            jobStartedAt.remove(key);
        }
    }

    private PrepareStatusDto readyDirectDto(String videoId, MediaType type, String directUrl, String qualityPreset) {
        String label = type == MediaType.AUDIO
                ? MediaQualityPresets.audioLabel(qualityPreset)
                : MediaQualityPresets.videoLabel(qualityPreset);
        return PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.READY)
                .streamUrl(directUrl)
                .contentType(mediaService.getStreamContentType(type))
                .quality(label)
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
        if (renderHost && !ytDlpService.hasCookies()) {
            return cloudCookiesRequiredMessage();
        }
        if (!ytDlpService.hasCookies()) {
            return base + " Cloud may need YouTube cookies — or use Mac backend on Wi‑Fi.";
        }
        return base + " Usually 3–10 seconds.";
    }

    private PrepareStatusDto readyProxyDto(String videoId, MediaType type, String qualityPreset) {
        String label = type == MediaType.AUDIO
                ? MediaQualityPresets.audioLabel(qualityPreset)
                : MediaQualityPresets.videoLabel(qualityPreset);
        return PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.READY)
                .streamUrl("/api/media/stream/" + videoId + "?type=" + type + "&quality=" + qualityPreset)
                .contentType(mediaService.getStreamContentType(type))
                .quality(label)
                .message("Stream proxy")
                .build();
    }

    private String cloudCookiesRequiredMessage() {
        return "YouTube is blocked on cloud. Pick SoundCloud/Web results, paste a direct link, "
                + "or set YOUTUBE_COOKIES_BASE64 on Render.";
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

    private PrepareStatusDto readyDto(String videoId, MediaType type, Path cached, String message, String qualityPreset) {
        String label = type == MediaType.AUDIO
                ? MediaQualityPresets.audioLabel(qualityPreset)
                : MediaQualityPresets.videoLabel(qualityPreset);
        return PrepareStatusDto.builder()
                .videoId(videoId)
                .type(type)
                .status(PrepareStatusDto.Status.READY)
                .streamUrl("/files/cache/" + cached.getFileName())
                .contentType(type == MediaType.AUDIO ? "audio/mp4" : "video/mp4")
                .quality(label)
                .message(message)
                .build();
    }

    private long prepareTimeoutMs() {
        return TimeUnit.SECONDS.toMillis(prepareTimeoutSeconds);
    }

    private static String jobKey(String videoId, MediaType type, String qualityPreset) {
        return videoId + ":" + type.name() + ":" + qualityPreset;
    }

    private void queueVideoFaceScan(String videoId) {
        try {
            faceScanService.queueMediaVideoScan(videoId, videoId);
        } catch (Exception e) {
            log.debug("Face scan queue skipped for {}: {}", videoId, e.getMessage());
        }
    }
}
