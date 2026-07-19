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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "user_libraries")
public class UserLibrary {

    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    @Builder.Default
    private List<LibraryPlaylist> playlists = new ArrayList<>();

    @Builder.Default
    private List<LibraryFavorite> favorites = new ArrayList<>();

    @Builder.Default
    private List<LibraryRecent> recent = new ArrayList<>();

    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LibraryPlaylist {
        private String id;
        private String name;
        private Instant createdAt;
        private Instant updatedAt;
        @Builder.Default
        private List<LibraryTrack> items = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LibraryTrack {
        private String id;
        private String title;
        private String type;
        private String thumbnailUrl;
        private String streamUrl;
        private String sourceUrl;
        private String videoId;
        private String localMediaId;
        private String quality;
        private String channel;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LibraryFavorite {
        private String id;
        private String videoId;
        private String title;
        private String thumbnailUrl;
        private String channel;
        private String sourceUrl;
        private String type;
        private Instant addedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LibraryRecent {
        private String id;
        private String title;
        private String thumbnailUrl;
        private String type;
        private String streamUrl;
        private String videoId;
        private String sourceUrl;
        private String libraryId;
        private String quality;
        private Instant playedAt;
    }
}
