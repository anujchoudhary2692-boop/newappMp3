package com.mediaapp.controller;

import com.mediaapp.dto.*;
import com.mediaapp.model.MediaItem;
import com.mediaapp.model.MediaType;
import com.mediaapp.service.MediaCacheService;
import com.mediaapp.service.MediaDiagnosticsService;
import com.mediaapp.service.MediaService;
import com.mediaapp.shared.features.FeatureFlagsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;
    private final MediaCacheService mediaCacheService;
    private final MediaDiagnosticsService mediaDiagnosticsService;
    private final FeatureFlagsService featureFlagsService;

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<MediaSearchResultDto>>> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "15") int limit) {
        featureFlagsService.requireEnabled("mediaSearch");
        return ResponseEntity.ok(ApiResponse.ok(mediaService.search(q, limit)));
    }

    @GetMapping("/stream-info")
    public ResponseEntity<ApiResponse<StreamInfoDto>> streamInfo(@RequestParam String sourceUrl) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(mediaService.getStreamInfo(sourceUrl)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/play/{videoId}")
    public ResponseEntity<ApiResponse<PlayUrlDto>> play(
            @PathVariable String videoId,
            @RequestParam MediaType type,
            @RequestParam(required = false) String quality) {
        try {
            PlayUrlDto dto = mediaService.preparePlayback(videoId, type);
            if (dto.getStreamUrl() != null && dto.getStreamUrl().contains("/api/media/prepare/")) {
                mediaCacheService.prepare(videoId, type, quality);
            }
            return ResponseEntity.ok(ApiResponse.ok(dto));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    /** Poll until READY — downloads/cache on server (works on Render; pipe stream does not). */
    @GetMapping("/prepare/{videoId}")
    public ResponseEntity<ApiResponse<PrepareStatusDto>> prepare(
            @PathVariable String videoId,
            @RequestParam MediaType type,
            @RequestParam(required = false) String quality,
            @RequestParam(required = false) String sourceUrl) {
        try {
            if (sourceUrl != null && !sourceUrl.isBlank()) {
                mediaService.registerSource(videoId, sourceUrl);
            }
            return ResponseEntity.ok(ApiResponse.ok(mediaCacheService.prepare(videoId, type, quality)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> mediaStatus() {
        return ResponseEntity.ok(ApiResponse.ok(mediaDiagnosticsService.snapshot()));
    }

    @GetMapping("/stream/{videoId}")
    public ResponseEntity<?> stream(
            @PathVariable String videoId,
            @RequestParam MediaType type,
            @RequestParam(required = false) String quality,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String rangeHeader) {
        try {
            var cached = mediaService.tryServeCachedStream(videoId, type, rangeHeader);
            if (cached.isPresent()) {
                return cached.get();
            }

            var direct = mediaService.tryServeDirectStream(videoId, type, rangeHeader, quality);
            if (direct.isPresent()) {
                return direct.get();
            }
        } catch (Exception e) {
            log.debug("Fast stream path failed for {} {}: {}", videoId, type, e.getMessage());
        }

        StreamingResponseBody body = outputStream -> {
            try {
                mediaService.writeStreamPipe(videoId, type, outputStream, quality);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Stream interrupted");
            }
        };
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, mediaService.getStreamContentType(type))
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CACHE_CONTROL, "no-cache")
                .body(body);
    }

    @PostMapping("/download")
    public ResponseEntity<ApiResponse<MediaItemDto>> download(@RequestBody DownloadRequest request) {
        try {
            featureFlagsService.requireEnabled("mediaDownload");
            MediaItem item = mediaService.download(
                    request.getVideoId(),
                    request.getTitle(),
                    request.getSourceUrl(),
                    request.getType(),
                    request.getQuality()
            );
            return ResponseEntity.ok(ApiResponse.ok("Download complete", toDto(item)));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/library/audio")
    public ResponseEntity<ApiResponse<List<MediaItemDto>>> audioLibrary() {
        List<MediaItemDto> items = mediaService.listByType(MediaType.AUDIO).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @GetMapping("/library/video")
    public ResponseEntity<ApiResponse<List<MediaItemDto>>> videoLibrary() {
        List<MediaItemDto> items = mediaService.listByType(MediaType.VIDEO).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok(items));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        try {
            mediaService.delete(id);
            return ResponseEntity.ok(ApiResponse.ok("Deleted", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    private MediaItemDto toDto(MediaItem item) {
        return MediaItemDto.builder()
                .id(item.getId())
                .title(item.getTitle())
                .sourceUrl(item.getSourceUrl())
                .type(item.getType())
                .fileName(item.getFileName())
                .streamUrl("/files/" + (item.getType() == MediaType.AUDIO ? "audio" : "video") + "/" + item.getFileName())
                .thumbnailUrl(item.getThumbnailUrl())
                .fileSizeBytes(item.getFileSizeBytes())
                .quality(item.getQuality())
                .durationSeconds(item.getDurationSeconds())
                .downloadedAt(item.getDownloadedAt() != null ? item.getDownloadedAt().toString() : null)
                .build();
    }
}
