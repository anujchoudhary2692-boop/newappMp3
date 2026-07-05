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
public class MultiPersonScanResultDto {
    private int facesDetected;
    @Builder.Default
    private List<PersonMatchDto> matches = new ArrayList<>();
}
