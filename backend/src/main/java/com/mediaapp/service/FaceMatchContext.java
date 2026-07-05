package com.mediaapp.service;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FaceMatchContext {
    private String devicePhotoId;
    private String sourceType;
    private Long sourceTimestampMs;
    private String captureId;
    private String mediaVideoId;
    private String mediaTitle;
    private Double latitude;
    private Double longitude;
    private String locationLabel;
}
