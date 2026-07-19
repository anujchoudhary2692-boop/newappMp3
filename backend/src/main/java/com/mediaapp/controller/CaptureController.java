package com.mediaapp.controller;

import com.mediaapp.dto.ApiResponse;
import com.mediaapp.dto.CaptureDto;
import com.mediaapp.dto.PlaceSummaryDto;
import com.mediaapp.model.CaptureType;
import com.mediaapp.service.CaptureExportService;
import com.mediaapp.service.CaptureService;
import com.mediaapp.util.RangeFileResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/captures")
@RequiredArgsConstructor
public class CaptureController {

    private final CaptureService captureService;
    private final CaptureExportService captureExportService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<CaptureDto>>> list() {
        return ResponseEntity.ok(ApiResponse.ok(captureService.listCaptures()));
    }

    @GetMapping("/places")
    public ResponseEntity<ApiResponse<List<PlaceSummaryDto>>> places() {
        return ResponseEntity.ok(ApiResponse.ok(captureService.listPlaces()));
    }

    @GetMapping("/map/geojson")
    public ResponseEntity<byte[]> mapGeoJson() {
        try {
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"captures_map.geojson\"")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(captureExportService.exportGeoJson().getBytes());
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage().getBytes());
        }
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(defaultValue = "geojson") String format) {
        try {
            return switch (format.toLowerCase()) {
                case "gpx" -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"captures.gpx\"")
                        .contentType(MediaType.APPLICATION_XML)
                        .body(captureExportService.exportGpx().getBytes());
                default -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"captures.geojson\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(captureExportService.exportGeoJson().getBytes());
            };
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage().getBytes());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CaptureDto>> get(@PathVariable String id) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(captureService.getCapture(id)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping(consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CaptureDto>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam CaptureType type,
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Double altitude,
            @RequestParam(required = false) Double gpsAccuracy,
            @RequestParam(required = false) String address,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) Long durationMs,
            @RequestParam(required = false) String clientCapturedAt,
            @RequestParam(required = false) Double heading,
            @RequestParam(required = false) String trackPointsJson) {
        try {
            CaptureDto capture = captureService.saveCapture(
                    file, type, latitude, longitude, altitude, gpsAccuracy,
                    address, city, country, durationMs, clientCapturedAt, heading, trackPointsJson);
            return ResponseEntity.ok(ApiResponse.ok("Capture saved", capture));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<org.springframework.core.io.Resource> file(
            @PathVariable String id,
            @RequestHeader(value = org.springframework.http.HttpHeaders.RANGE, required = false) String rangeHeader)
            throws IOException {
        try {
            Path file = captureService.getCaptureFile(id);
            String fileName = captureService.getCaptureFileName(id);
            CaptureType type = captureService.getCaptureType(id);
            String contentType = type == CaptureType.PHOTO
                    ? "image/jpeg"
                    : RangeFileResponse.resolveVideoContentType(fileName);
            return RangeFileResponse.serve(file, contentType, rangeHeader);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        try {
            captureService.deleteCapture(id);
            return ResponseEntity.ok(ApiResponse.ok("Deleted", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }
}
