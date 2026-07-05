package com.mediaapp.dto;

import com.mediaapp.model.MediaType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DownloadRequest {
    private String videoId;
    private String title;
    private String sourceUrl;
    private MediaType type;
    /** Audio: 128, 320, m4a. Video: 360, 720, 1080. */
    private String quality;
}
