package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaceClusterDto {
    private String id;
    private String name;
    private String personId;
    private int faceCount;
    private String sampleImageUrl;
    private String createdAt;
    private String updatedAt;
}
