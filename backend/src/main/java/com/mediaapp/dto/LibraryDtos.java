package com.mediaapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

public final class LibraryDtos {
    private LibraryDtos() {}

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LibrarySnapshotDto {
        @Builder.Default
        private List<PlaylistDto> playlists = new ArrayList<>();
        @Builder.Default
        private List<FavoriteDto> favorites = new ArrayList<>();
        @Builder.Default
        private List<RecentDto> recent = new ArrayList<>();
        private String updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PlaylistDto {
        private String id;
        private String name;
        private String createdAt;
        private String updatedAt;
        @Builder.Default
        private List<TrackDto> items = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TrackDto {
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
    public static class FavoriteDto {
        private String id;
        private String videoId;
        private String title;
        private String thumbnailUrl;
        private String channel;
        private String sourceUrl;
        private String type;
        private String addedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentDto {
        private String id;
        private String title;
        private String thumbnailUrl;
        private String type;
        private String streamUrl;
        private String videoId;
        private String sourceUrl;
        private String libraryId;
        private String quality;
        private String playedAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreatePlaylistRequest {
        private String name;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RenamePlaylistRequest {
        private String name;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddTrackRequest {
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
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReorderTracksRequest {
        private List<String> trackIds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ToggleFavoriteRequest {
        private String videoId;
        private String title;
        private String thumbnailUrl;
        private String channel;
        private String sourceUrl;
        private String type;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PushRecentRequest {
        private String title;
        private String thumbnailUrl;
        private String type;
        private String streamUrl;
        private String videoId;
        private String sourceUrl;
        private String libraryId;
        private String quality;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MigrateLibraryRequest {
        private List<PlaylistDto> playlists;
        private List<FavoriteDto> favorites;
        private List<RecentDto> recent;
    }
}
