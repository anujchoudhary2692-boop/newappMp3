package com.mediaapp.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Indexed face embedding from captures/person photos for gallery-wide search. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "face_index")
public class FaceIndexEntry {

    @Id
    private String id;

    @Indexed
    private String clusterId;

    @Indexed
    private String personId;

    /** CAPTURE | PERSON_PHOTO | MEDIA */
    private String sourceType;
    private String sourceId;
    private String imagePath;
    private String cropPath;

    private Integer bboxX;
    private Integer bboxY;
    private Integer bboxW;
    private Integer bboxH;

    @Builder.Default
    private List<Float> embedding = new ArrayList<>();

    private Instant createdAt;
}
