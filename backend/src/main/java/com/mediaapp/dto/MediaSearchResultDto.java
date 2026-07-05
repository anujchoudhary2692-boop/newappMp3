package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MediaSearchResultDto {
    private String videoId;
    private String title;
    private String thumbnailUrl;
    private String channel;
    private Integer durationSeconds;
    private String sourceUrl;
    private String audioFormat;
    private String videoFormat;
    private String audioStreamUrl;
    private String videoStreamUrl;
    /** e.g. Soundcloud, Web, Youtube */
    private String source;
}
