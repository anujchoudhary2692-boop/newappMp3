package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PersonMatchDto {
    private String personId;
    private String personName;
    private double confidence;
    private boolean matched;
    private boolean saved;
    private String photoId;
    private int faceIndex;
}
