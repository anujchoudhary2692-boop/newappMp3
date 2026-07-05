package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PersonTimelineEntryDto {
    private String id;
    private String personId;
    private String personName;
    private String imageUrl;
    private double confidence;
    private String matchedAt;
    private String sourceType;
    private Long sourceTimestampMs;
    private String devicePhotoId;
    private String captureId;
    private String mediaVideoId;
    private String mediaTitle;
    private Double latitude;
    private Double longitude;
    private String locationLabel;
    private Boolean groupPhoto;
    private Integer facesDetected;
    private String playbackUrl;
}
