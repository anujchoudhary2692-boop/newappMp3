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
@Document(collection = "persons")
public class Person {

    @Id
    private String id;

    private String name;
    private String notes;

    @Builder.Default
    private List<String> imagePaths = new ArrayList<>();

    /** SFace neural-network embeddings (one vector per registered photo). */
    @Builder.Default
    private List<List<Float>> faceEmbeddings = new ArrayList<>();

    /** Engine used for embeddings: opencv or insightface. */
    @Builder.Default
    private String embeddingEngine = "opencv";

    /** View angle per registered photo (FRONT, LEFT, RIGHT, PARTIAL, etc.). */
    @Builder.Default
    private List<String> faceViewAngles = new ArrayList<>();

    private Instant createdAt;
    private Instant updatedAt;
}
