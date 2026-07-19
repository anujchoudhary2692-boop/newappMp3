package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FaceStatusDto {
    private boolean engineReady;
    private int registeredCount;
    private String message;
    private String engineType;
    /** opencv | insightface | insightface-stub */
    private String engineMode;
    private boolean insightFacePackaged;
}
