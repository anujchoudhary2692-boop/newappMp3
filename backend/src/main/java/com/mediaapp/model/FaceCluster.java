package com.mediaapp.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "face_clusters")
public class FaceCluster {

    @Id
    private String id;

    /** Display name; null until user names the cluster. */
    private String name;

    /** Linked Person id after naming/merge into registered gallery. */
    private String personId;

    @Builder.Default
    private List<Float> centroid = new ArrayList<>();

    @Builder.Default
    private List<String> sampleImagePaths = new ArrayList<>();

    @Builder.Default
    private int faceCount = 0;

    private Instant createdAt;
    private Instant updatedAt;
}
