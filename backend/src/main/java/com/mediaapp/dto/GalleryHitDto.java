package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GalleryHitDto {
    private String indexId;
    private String clusterId;
    private String personId;
    private String personName;
    private String sourceType;
    private String sourceId;
    private String imageUrl;
    private String cropUrl;
    private double confidence;
    private Integer bboxX;
    private Integer bboxY;
    private Integer bboxW;
    private Integer bboxH;
}
