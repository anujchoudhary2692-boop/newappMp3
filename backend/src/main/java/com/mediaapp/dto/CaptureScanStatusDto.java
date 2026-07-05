package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaptureScanStatusDto {
    private String captureId;
    private String scanStatus;
    private int matchCount;
    private String message;
}
