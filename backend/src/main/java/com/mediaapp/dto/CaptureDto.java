package com.mediaapp.dto;

import com.mediaapp.model.CaptureType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CaptureDto {

    private String id;
    private CaptureType type;
    private String fileName;
    private String fileUrl;
    private String thumbnailUrl;
    private Double latitude;
    private Double longitude;
    private Double altitude;
    private String address;
    private String city;
    private String country;
    private String locationLabel;
    private String capturedAt;
    private Long durationMs;
    private Double gpsAccuracy;
    private String scanStatus;
    private Integer matchCount;
}
