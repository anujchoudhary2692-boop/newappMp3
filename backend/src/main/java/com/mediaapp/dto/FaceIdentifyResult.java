package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaceIdentifyResult {
    private String personId;
    private String personName;
    private double confidence;
    private boolean matched;
    private int facesScanned;
    private double matchGap;
    @Builder.Default
    private List<FaceCandidateDto> candidates = new ArrayList<>();
    @Builder.Default
    private List<GalleryHitDto> galleryHits = new ArrayList<>();
    private Integer probeBboxX;
    private Integer probeBboxY;
    private Integer probeBboxW;
    private Integer probeBboxH;
}
