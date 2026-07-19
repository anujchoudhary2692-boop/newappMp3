package com.mediaapp.controller;

import com.mediaapp.dto.ApiResponse;
import com.mediaapp.dto.LibraryDtos.*;
import com.mediaapp.service.UserLibraryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/library")
@RequiredArgsConstructor
public class LibraryController {

    private final UserLibraryService libraryService;

    @GetMapping
    public ApiResponse<LibrarySnapshotDto> snapshot() {
        try {
            return ApiResponse.ok(libraryService.getSnapshot());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/migrate")
    public ApiResponse<LibrarySnapshotDto> migrate(@RequestBody MigrateLibraryRequest body) {
        try {
            return ApiResponse.ok(libraryService.migrate(body));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/playlists")
    public ApiResponse<List<PlaylistDto>> playlists() {
        try {
            return ApiResponse.ok(libraryService.getSnapshot().getPlaylists());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/playlists")
    public ApiResponse<PlaylistDto> createPlaylist(@RequestBody CreatePlaylistRequest body) {
        try {
            return ApiResponse.ok(libraryService.createPlaylist(body));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PatchMapping("/playlists/{id}")
    public ApiResponse<PlaylistDto> renamePlaylist(@PathVariable String id, @RequestBody RenamePlaylistRequest body) {
        try {
            return ApiResponse.ok(libraryService.renamePlaylist(id, body));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @DeleteMapping("/playlists/{id}")
    public ApiResponse<Map<String, Boolean>> deletePlaylist(@PathVariable String id) {
        try {
            libraryService.deletePlaylist(id);
            return ApiResponse.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/playlists/{id}/tracks")
    public ApiResponse<PlaylistDto> addTrack(@PathVariable String id, @RequestBody AddTrackRequest body) {
        try {
            return ApiResponse.ok(libraryService.addTrack(id, body));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @DeleteMapping("/playlists/{id}/tracks/{trackId}")
    public ApiResponse<PlaylistDto> removeTrack(@PathVariable String id, @PathVariable String trackId) {
        try {
            return ApiResponse.ok(libraryService.removeTrack(id, trackId));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PutMapping("/playlists/{id}/tracks/order")
    public ApiResponse<PlaylistDto> reorder(@PathVariable String id, @RequestBody ReorderTracksRequest body) {
        try {
            return ApiResponse.ok(libraryService.reorderTracks(id, body));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/favorites")
    public ApiResponse<List<FavoriteDto>> favorites(@RequestParam(required = false) String type) {
        try {
            return ApiResponse.ok(libraryService.listFavorites(type));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/favorites/toggle")
    public ApiResponse<Map<String, Boolean>> toggleFavorite(@RequestBody ToggleFavoriteRequest body) {
        try {
            boolean liked = libraryService.toggleFavorite(body);
            return ApiResponse.ok(Map.of("favorited", liked));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @DeleteMapping("/favorites/{id}")
    public ApiResponse<Map<String, Boolean>> removeFavorite(@PathVariable String id) {
        try {
            libraryService.removeFavorite(id);
            return ApiResponse.ok(Map.of("deleted", true));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @GetMapping("/recent")
    public ApiResponse<List<RecentDto>> recent() {
        try {
            return ApiResponse.ok(libraryService.listRecent());
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }

    @PostMapping("/recent")
    public ApiResponse<List<RecentDto>> pushRecent(@RequestBody PushRecentRequest body) {
        try {
            return ApiResponse.ok(libraryService.pushRecent(body));
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}
