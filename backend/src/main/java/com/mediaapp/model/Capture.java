package com.mediaapp.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "captures")
public class Capture {

    @Id
    private String id;

    private CaptureType type;
    private String fileName;
    private String filePath;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    /** GPS accuracy in meters from device. */
    private Double gpsAccuracy;
    private String address;
    private String city;
    private String country;
    /** Client-side capture time (EXIF or device clock). */
    private Instant clientCapturedAt;
    private Instant capturedAt;
    private Long durationMs;
    /** PENDING, SCANNING, DONE, SKIPPED, FAILED */
    private String scanStatus;
    private Integer matchCount;
}
