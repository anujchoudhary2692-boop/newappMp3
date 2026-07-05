package com.mediaapp.service;

import com.mediaapp.dto.CaptureScanStatusDto;
import com.mediaapp.dto.MultiPersonScanResultDto;
import com.mediaapp.dto.PersonMatchDto;
import com.mediaapp.dto.PersonTimelineEntryDto;
import com.mediaapp.model.Capture;
import com.mediaapp.model.CaptureType;
import com.mediaapp.model.MediaType;
import com.mediaapp.model.PersonPhoto;
import com.mediaapp.repository.CaptureRepository;
import com.mediaapp.repository.PersonPhotoRepository;
import com.mediaapp.repository.PersonRepository;
import com.mediaapp.shared.features.FeatureFlagsProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FaceScanService {

    private final FaceRecognitionService faceRecognitionService;
    private final FaceAiEngine faceAiEngine;
    private final FeatureFlagsProperties featureFlags;
    private final CaptureRepository captureRepository;
    private final PersonPhotoRepository personPhotoRepository;
    private final PersonRepository personRepository;
    private final VideoFrameService videoFrameService;
    private final MediaService mediaService;
    private ExecutorService executor;

    @PostConstruct
    void init() {
        executor = Executors.newFixedThreadPool(2);
    }

    @PreDestroy
    void shutdown() {
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    public boolean isEnabled() {
        return featureFlags.isFaceAi() && faceAiEngine.isReady();
    }

    public void queueCaptureScan(String captureId) {
        if (!isEnabled()) {
            markCaptureScan(captureId, "SKIPPED", 0, "Face AI disabled");
            return;
        }
        executor.submit(() -> {
            try {
                scanCapture(captureId);
            } catch (Exception e) {
                log.warn("Capture scan failed for {}: {}", captureId, e.getMessage());
                markCaptureScan(captureId, "FAILED", 0, e.getMessage());
            }
        });
    }

    public void queueMediaVideoScan(String videoId, String title) {
        if (!isEnabled()) {
            return;
        }
        executor.submit(() -> {
            try {
                scanCachedMediaVideo(videoId, title);
            } catch (Exception e) {
                log.warn("Media video scan failed for {}: {}", videoId, e.getMessage());
            }
        });
    }

    public CaptureScanStatusDto scanCapture(String captureId) throws Exception {
        Capture capture = captureRepository.findById(captureId)
                .orElseThrow(() -> new IllegalArgumentException("Capture not found"));
        if (!isEnabled()) {
            return markCaptureScan(captureId, "SKIPPED", 0, "Face AI disabled");
        }

        markCaptureScan(captureId, "SCANNING", capture.getMatchCount() != null ? capture.getMatchCount() : 0, "Scanning…");
        Path file = Path.of(capture.getFilePath());
        String locationLabel = buildLocationLabel(capture);
        int saved = 0;

        if (capture.getType() == CaptureType.PHOTO) {
            FaceMatchContext ctx = FaceMatchContext.builder()
                    .devicePhotoId("capture:" + captureId)
                    .sourceType("CAPTURE")
                    .captureId(captureId)
                    .latitude(capture.getLatitude())
                    .longitude(capture.getLongitude())
                    .locationLabel(locationLabel)
                    .build();
            MultiPersonScanResultDto result = faceRecognitionService.scanImagePathForAllPersons(file, ctx, true);
            saved = (int) result.getMatches().stream().filter(PersonMatchDto::isSaved).count();
        } else {
            List<VideoFrameService.FrameSample> frames = videoFrameService.extractFrames(file, capture.getDurationMs());
            try {
                for (VideoFrameService.FrameSample frame : frames) {
                    FaceMatchContext ctx = FaceMatchContext.builder()
                            .devicePhotoId("capture:" + captureId + "@" + frame.timestampMs())
                            .sourceType("CAPTURE_VIDEO")
                            .sourceTimestampMs(frame.timestampMs())
                            .captureId(captureId)
                            .latitude(capture.getLatitude())
                            .longitude(capture.getLongitude())
                            .locationLabel(locationLabel)
                            .build();
                    MultiPersonScanResultDto result = faceRecognitionService.scanImagePathForAllPersons(
                            frame.imagePath(), ctx, true);
                    saved += (int) result.getMatches().stream().filter(PersonMatchDto::isSaved).count();
                }
            } finally {
                videoFrameService.cleanupFrames(frames);
            }
        }

        return markCaptureScan(captureId, "DONE", saved, saved > 0 ? saved + " match(es) saved" : "No matches");
    }

    public void scanCachedMediaVideo(String videoId, String title) throws Exception {
        if (!isEnabled()) {
            return;
        }
        Path cached = mediaService.cachePathFor(videoId, MediaType.VIDEO);
        if (!Files.exists(cached) || !mediaService.isCachedVideoPlayable(cached)) {
            return;
        }

        List<VideoFrameService.FrameSample> frames = videoFrameService.extractFrames(cached, null);
        try {
            for (VideoFrameService.FrameSample frame : frames) {
                FaceMatchContext ctx = FaceMatchContext.builder()
                        .devicePhotoId("media:" + videoId + "@" + frame.timestampMs())
                        .sourceType("MEDIA_VIDEO")
                        .sourceTimestampMs(frame.timestampMs())
                        .mediaVideoId(videoId)
                        .mediaTitle(title)
                        .build();
                faceRecognitionService.scanImagePathForAllPersons(frame.imagePath(), ctx, true);
            }
        } finally {
            videoFrameService.cleanupFrames(frames);
        }
    }

    public CaptureScanStatusDto getCaptureScanStatus(String captureId) {
        Capture capture = captureRepository.findById(captureId)
                .orElseThrow(() -> new IllegalArgumentException("Capture not found"));
        return CaptureScanStatusDto.builder()
                .captureId(captureId)
                .scanStatus(capture.getScanStatus() != null ? capture.getScanStatus() : "PENDING")
                .matchCount(capture.getMatchCount() != null ? capture.getMatchCount() : 0)
                .message(null)
                .build();
    }

    public List<PersonTimelineEntryDto> getPersonTimeline(String personId, int limit) {
        personRepository.findById(personId)
                .orElseThrow(() -> new IllegalArgumentException("Person not found"));
        return personPhotoRepository.findByPersonIdOrderByMatchedAtDesc(personId).stream()
                .limit(Math.max(1, Math.min(limit, 500)))
                .map(photo -> faceRecognitionService.toTimelineEntry(photo))
                .sorted(Comparator.comparing(PersonTimelineEntryDto::getMatchedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public List<PersonTimelineEntryDto> getRecentAlerts(int limit) {
        Instant since = Instant.now().minusSeconds(86400);
        return personPhotoRepository.findByMatchedAtAfterOrderByMatchedAtDesc(since).stream()
                .limit(Math.max(1, Math.min(limit, 100)))
                .map(photo -> {
                    PersonTimelineEntryDto entry = faceRecognitionService.toTimelineEntry(photo);
                    personRepository.findById(photo.getPersonId())
                            .ifPresent(p -> entry.setPersonName(p.getName()));
                    return entry;
                })
                .toList();
    }

    private CaptureScanStatusDto markCaptureScan(String captureId, String status, int matchCount, String message) {
        captureRepository.findById(captureId).ifPresent(capture -> {
            capture.setScanStatus(status);
            capture.setMatchCount(matchCount);
            captureRepository.save(capture);
        });
        return CaptureScanStatusDto.builder()
                .captureId(captureId)
                .scanStatus(status)
                .matchCount(matchCount)
                .message(message)
                .build();
    }

    private String buildLocationLabel(Capture capture) {
        if (capture.getCity() != null && capture.getCountry() != null) {
            return capture.getCity() + ", " + capture.getCountry();
        }
        if (capture.getAddress() != null && !capture.getAddress().isBlank()) {
            return capture.getAddress();
        }
        if (capture.getLatitude() != null && capture.getLongitude() != null) {
            return String.format("%.4f, %.4f", capture.getLatitude(), capture.getLongitude());
        }
        return null;
    }
}
