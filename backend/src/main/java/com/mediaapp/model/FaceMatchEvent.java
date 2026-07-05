package com.mediaapp.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "face_match_events")
public class FaceMatchEvent {

    @Id
    private String id;
    private String personId;
    private String personName;
    private String photoId;
    private String sourceType;
    private double confidence;
    private String locationLabel;
    private Double latitude;
    private Double longitude;
    private String captureId;
    private String mediaVideoId;
    private String mediaTitle;
    private Long sourceTimestampMs;
    private Instant matchedAt;
}
