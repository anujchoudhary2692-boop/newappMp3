package com.mediaapp.service;

import com.mediaapp.dto.CaptureDto;
import com.mediaapp.model.Capture;
import com.mediaapp.model.CaptureType;
import com.mediaapp.repository.CaptureRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CaptureService {

    private final CaptureRepository captureRepository;
    private final Path capturesPath;
    private final FaceScanService faceScanService;
    private final GeocodeService geocodeService;

    public CaptureDto saveCapture(
            MultipartFile file,
            CaptureType type,
            Double latitude,
            Double longitude,
            Double altitude,
            Double gpsAccuracy,
            String address,
            String city,
            String country,
            Long durationMs,
            String clientCapturedAt) throws IOException {

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Capture file is required");
        }

        String extension = resolveExtension(file.getOriginalFilename(), type);
        String fileName = UUID.randomUUID() + extension;
        Path targetDir = capturesPath.resolve(type == CaptureType.PHOTO ? "photos" : "videos");
        Files.createDirectories(targetDir);
        Path target = targetDir.resolve(fileName).normalize();

        if (!target.startsWith(capturesPath)) {
            throw new IllegalArgumentException("Invalid capture path");
        }

        file.transferTo(target.toFile());

        Instant clientTime = parseInstant(clientCapturedAt);
        String resolvedAddress = address;
        String resolvedCity = city;
        String resolvedCountry = country;
        if (latitude != null && longitude != null
                && (isBlank(resolvedCity) || isBlank(resolvedCountry))) {
            var geocoded = geocodeService.reverseGeocode(latitude, longitude);
            if (geocoded.isPresent()) {
                if (isBlank(resolvedAddress)) {
                    resolvedAddress = geocoded.get().address();
                }
                if (isBlank(resolvedCity)) {
                    resolvedCity = geocoded.get().city();
                }
                if (isBlank(resolvedCountry)) {
                    resolvedCountry = geocoded.get().country();
                }
            }
        }

        Capture capture = Capture.builder()
                .type(type)
                .fileName(fileName)
                .filePath(target.toString())
                .latitude(latitude)
                .longitude(longitude)
                .altitude(altitude)
                .gpsAccuracy(gpsAccuracy)
                .address(resolvedAddress)
                .city(resolvedCity)
                .country(resolvedCountry)
                .clientCapturedAt(clientTime)
                .capturedAt(clientTime != null ? clientTime : Instant.now())
                .durationMs(durationMs)
                .scanStatus("PENDING")
                .matchCount(0)
                .build();

        Capture saved = captureRepository.save(capture);
        faceScanService.queueCaptureScan(saved.getId());
        return toDto(saved);
    }

    public List<CaptureDto> listCaptures() {
        return captureRepository.findAllByOrderByCapturedAtDesc().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<CaptureDto> listGeoCaptures() {
        return captureRepository.findAllByOrderByCapturedAtDesc().stream()
                .filter(c -> c.getLatitude() != null && c.getLongitude() != null)
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public CaptureDto getCapture(String id) {
        Capture capture = captureRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Capture not found"));
        return toDto(capture);
    }

    public Path getCaptureFile(String id) {
        Capture capture = captureRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Capture not found"));
        Path file = Path.of(capture.getFilePath()).normalize();
        if (!Files.exists(file) || !Files.isRegularFile(file)) {
            throw new IllegalArgumentException("Capture file missing");
        }
        return file;
    }

    public CaptureType getCaptureType(String id) {
        return captureRepository.findById(id)
                .map(Capture::getType)
                .orElseThrow(() -> new IllegalArgumentException("Capture not found"));
    }

    public String getCaptureFileName(String id) {
        return captureRepository.findById(id)
                .map(Capture::getFileName)
                .orElseThrow(() -> new IllegalArgumentException("Capture not found"));
    }

    public void deleteCapture(String id) throws IOException {
        Capture capture = captureRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Capture not found"));
        Path file = Path.of(capture.getFilePath()).normalize();
        if (Files.exists(file)) {
            Files.delete(file);
        }
        captureRepository.delete(capture);
    }

    private CaptureDto toDto(Capture capture) {
        String locationLabel = buildLocationLabel(capture);
        return CaptureDto.builder()
                .id(capture.getId())
                .type(capture.getType())
                .fileName(capture.getFileName())
                .fileUrl("/api/captures/" + capture.getId() + "/file")
                .thumbnailUrl(capture.getType() == CaptureType.PHOTO
                        ? "/api/captures/" + capture.getId() + "/file"
                        : null)
                .latitude(capture.getLatitude())
                .longitude(capture.getLongitude())
                .altitude(capture.getAltitude())
                .gpsAccuracy(capture.getGpsAccuracy())
                .address(capture.getAddress())
                .city(capture.getCity())
                .country(capture.getCountry())
                .locationLabel(locationLabel)
                .capturedAt(capture.getCapturedAt() != null ? capture.getCapturedAt().toString() : null)
                .durationMs(capture.getDurationMs())
                .scanStatus(capture.getScanStatus())
                .matchCount(capture.getMatchCount())
                .build();
    }

    private String buildLocationLabel(Capture capture) {
        if (capture.getCity() != null && capture.getCountry() != null) {
            return capture.getCity() + ", " + capture.getCountry();
        }
        if (capture.getAddress() != null && !capture.getAddress().isBlank()) {
            String[] parts = capture.getAddress().split(",");
            if (parts.length >= 2) {
                return parts[0].trim() + ", " + parts[1].trim();
            }
            return capture.getAddress();
        }
        if (capture.getLatitude() != null && capture.getLongitude() != null) {
            return String.format("%.4f, %.4f", capture.getLatitude(), capture.getLongitude());
        }
        return "No location";
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String resolveExtension(String originalName, CaptureType type) {
        if (originalName != null) {
            int dot = originalName.lastIndexOf('.');
            if (dot > 0 && dot < originalName.length() - 1) {
                return originalName.substring(dot).toLowerCase();
            }
        }
        return type == CaptureType.PHOTO ? ".jpg" : ".mp4";
    }
}
