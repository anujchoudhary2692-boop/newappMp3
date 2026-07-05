package com.mediaapp.controller;

import com.mediaapp.dto.ApiResponse;
import com.mediaapp.dto.CaptureScanStatusDto;
import com.mediaapp.dto.MultiPersonScanResultDto;
import com.mediaapp.dto.PersonTimelineEntryDto;
import com.mediaapp.dto.FaceIdentifyResult;
import com.mediaapp.dto.LibraryScanResultDto;
import com.mediaapp.dto.PersonDto;
import com.mediaapp.dto.PersonPhotoDto;
import com.mediaapp.dto.UpdatePersonRequest;
import com.mediaapp.service.FaceRecognitionService;
import com.mediaapp.service.FaceScanService;
import com.mediaapp.service.FaceAlertService;
import com.mediaapp.service.TraceExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Locale;

@RestController
@RequestMapping("/api/faces")
@RequiredArgsConstructor
public class FaceController {

    private final FaceRecognitionService faceRecognitionService;
    private final FaceScanService faceScanService;
    private final FaceAlertService faceAlertService;
    private final TraceExportService traceExportService;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<com.mediaapp.dto.FaceStatusDto>> status() {
        return ResponseEntity.ok(ApiResponse.ok(faceRecognitionService.getStatus()));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PersonDto>>> list() {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceRecognitionService.listPersons()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping(value = "/register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<PersonDto>> register(
            @RequestParam String name,
            @RequestParam(required = false) String notes,
            @RequestParam(required = false) String viewHint,
            @RequestParam("image") MultipartFile image) {
        try {
            PersonDto person = faceRecognitionService.registerPerson(name, notes, image, viewHint);
            String viewLabel = person.getLastRegisteredView() != null
                    ? person.getLastRegisteredView()
                    : "ANY";
            return ResponseEntity.ok(ApiResponse.ok(
                    "Face saved (" + viewLabel + " view). Add more angles for best accuracy.",
                    person));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping(value = "/identify", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<FaceIdentifyResult>> identify(@RequestParam("image") MultipartFile image) {
        try {
            FaceIdentifyResult result = faceRecognitionService.identify(image);
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/person/{personId}/photos")
    public ResponseEntity<ApiResponse<List<PersonPhotoDto>>> personPhotos(@PathVariable String personId) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceRecognitionService.listPersonPhotos(personId)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping(value = "/person/{personId}/scan-library", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<LibraryScanResultDto>> scanLibraryPhoto(
            @PathVariable String personId,
            @RequestParam("image") MultipartFile image,
            @RequestParam(required = false) String devicePhotoId,
            @RequestParam(required = false, defaultValue = "PHOTO") String sourceType,
            @RequestParam(required = false) Long sourceTimestampMs) {
        try {
            LibraryScanResultDto result = faceRecognitionService.scanLibraryPhoto(
                    personId, image, devicePhotoId, sourceType, sourceTimestampMs);
            return ResponseEntity.ok(ApiResponse.ok(result));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @DeleteMapping("/photos/{photoId}")
    public ResponseEntity<ApiResponse<Void>> deletePhoto(@PathVariable String photoId) {
        try {
            faceRecognitionService.deletePersonPhoto(photoId);
            return ResponseEntity.ok(ApiResponse.ok("Deleted", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<PersonDto>> update(
            @PathVariable String id,
            @RequestBody UpdatePersonRequest body) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(
                    faceRecognitionService.updatePerson(id, body.getName(), body.getNotes())));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        try {
            faceRecognitionService.deletePerson(id);
            return ResponseEntity.ok(ApiResponse.ok("Deleted", null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/person/{personId}/timeline")
    public ResponseEntity<ApiResponse<List<PersonTimelineEntryDto>>> timeline(
            @PathVariable String personId,
            @RequestParam(defaultValue = "200") int limit) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceScanService.getPersonTimeline(personId, limit)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/alerts/recent")
    public ResponseEntity<ApiResponse<List<PersonTimelineEntryDto>>> recentAlerts(
            @RequestParam(defaultValue = "50") int limit) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceScanService.getRecentAlerts(limit)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping(value = "/scan-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<MultiPersonScanResultDto>> scanImage(
            @RequestParam("image") MultipartFile image,
            @RequestParam(defaultValue = "true") boolean save) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceRecognitionService.scanImageAgainstAll(image, save)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/scan-capture/{captureId}")
    public ResponseEntity<ApiResponse<CaptureScanStatusDto>> scanCapture(@PathVariable String captureId) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceScanService.scanCapture(captureId)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/capture/{captureId}/scan-status")
    public ResponseEntity<ApiResponse<CaptureScanStatusDto>> captureScanStatus(@PathVariable String captureId) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceScanService.getCaptureScanStatus(captureId)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @PostMapping("/scan-media/{videoId}")
    public ResponseEntity<ApiResponse<String>> scanMedia(@PathVariable String videoId) {
        try {
            faceScanService.queueMediaVideoScan(videoId, videoId);
            return ResponseEntity.ok(ApiResponse.ok("Media face scan queued", videoId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/person/{personId}/timeline/export")
    public ResponseEntity<byte[]> exportTimeline(
            @PathVariable String personId,
            @RequestParam(defaultValue = "csv") String format,
            @RequestParam(defaultValue = "500") int limit) {
        try {
            String personName = faceRecognitionService.listPersons().stream()
                    .filter(p -> personId.equals(p.getId()))
                    .map(PersonDto::getName)
                    .findFirst()
                    .orElse("person");
            String safeName = personName.replaceAll("[^a-zA-Z0-9._-]", "_");
            return switch (format.toLowerCase(Locale.ROOT)) {
                case "json" -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeName + "_trace.json\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(traceExportService.exportPersonJson(personId, limit).getBytes());
                case "geojson" -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeName + "_trace.geojson\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(traceExportService.exportPersonGeoJson(personId, limit).getBytes());
                default -> ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + safeName + "_trace.csv\"")
                        .contentType(new MediaType("text", "csv"))
                        .body(traceExportService.exportPersonCsv(personId, limit).getBytes());
            };
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage().getBytes());
        }
    }

    @GetMapping("/audit/recent")
    public ResponseEntity<ApiResponse<List<PersonTimelineEntryDto>>> auditRecent(
            @RequestParam(defaultValue = "100") int limit) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(faceAlertService.recentAudit(limit)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error(e.getMessage()));
        }
    }

    @GetMapping("/image")
    public ResponseEntity<byte[]> image(@RequestParam String path) {
        try {
            byte[] data = faceRecognitionService.getFaceImage(path);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.IMAGE_JPEG_VALUE)
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }
}
