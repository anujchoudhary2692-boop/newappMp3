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
@Document(collection = "person_photos")
public class PersonPhoto {

    @Id
    private String id;

    private String personId;
    private String fileName;
    private String filePath;
    private double confidence;
    private String devicePhotoId;
    private Instant matchedAt;
    private String sourceType;
    /** Milliseconds into video when matched (null for photos) */
    private Long sourceTimestampMs;
    /** How many faces were in the image/frame */
    private Integer facesDetected;
    /** True when multiple faces were present (group photo / crowd) */
    private Boolean groupPhoto;
    /** Which face index matched (0-based) */
    private Integer matchedFaceIndex;
    /** Linked camera capture */
    private String captureId;
    /** Cached media video id */
    private String mediaVideoId;
    private String mediaTitle;
    private Double latitude;
    private Double longitude;
    private String locationLabel;
}
