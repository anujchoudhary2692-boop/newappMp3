package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PlaceSummaryDto {
    private String placeKey;
    private String city;
    private String country;
    private int count;
    private Double latitude;
    private Double longitude;
    private String sampleCaptureId;
}
