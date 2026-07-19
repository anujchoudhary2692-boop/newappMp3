package com.mediaapp.service;

import com.mediaapp.dto.LibraryDtos.*;
import com.mediaapp.model.UserLibrary;
import com.mediaapp.model.UserLibrary.*;
import com.mediaapp.repository.UserLibraryRepository;
import com.mediaapp.security.AuthContext;
import com.mediaapp.security.AuthContextHolder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserLibraryService {

    private static final int MAX_RECENT = 30;

    private final UserLibraryRepository repository;

    public LibrarySnapshotDto getSnapshot() {
        UserLibrary lib = requireLibrary();
        return toSnapshot(lib);
    }

    public PlaylistDto createPlaylist(CreatePlaylistRequest req) {
        String name = requireName(req != null ? req.getName() : null);
        UserLibrary lib = requireLibrary();
        Instant now = Instant.now();
        LibraryPlaylist pl = LibraryPlaylist.builder()
                .id("pl_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .name(name)
                .createdAt(now)
                .updatedAt(now)
                .items(new ArrayList<>())
                .build();
        lib.getPlaylists().add(0, pl);
        lib.setUpdatedAt(now);
        repository.save(lib);
        return toPlaylist(pl);
    }

    public PlaylistDto renamePlaylist(String id, RenamePlaylistRequest req) {
        String name = requireName(req != null ? req.getName() : null);
        UserLibrary lib = requireLibrary();
        LibraryPlaylist pl = findPlaylist(lib, id);
        pl.setName(name);
        pl.setUpdatedAt(Instant.now());
        lib.setUpdatedAt(pl.getUpdatedAt());
        repository.save(lib);
        return toPlaylist(pl);
    }

    public void deletePlaylist(String id) {
        UserLibrary lib = requireLibrary();
        lib.getPlaylists().removeIf(p -> id.equals(p.getId()));
        lib.setUpdatedAt(Instant.now());
        repository.save(lib);
    }

    public PlaylistDto addTrack(String playlistId, AddTrackRequest req) {
        if (req == null || isBlank(req.getTitle()) || isBlank(req.getType())) {
            throw new IllegalArgumentException("title and type are required");
        }
        UserLibrary lib = requireLibrary();
        LibraryPlaylist pl = findPlaylist(lib, playlistId);
        boolean dup = pl.getItems().stream().anyMatch(t ->
                (req.getVideoId() != null && req.getVideoId().equals(t.getVideoId()) && req.getType().equals(t.getType()))
                        || (req.getLocalMediaId() != null && req.getLocalMediaId().equals(t.getLocalMediaId())));
        if (!dup) {
            pl.getItems().add(LibraryTrack.builder()
                    .id("tr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                    .title(req.getTitle())
                    .type(req.getType())
                    .thumbnailUrl(req.getThumbnailUrl())
                    .streamUrl(req.getStreamUrl())
                    .sourceUrl(req.getSourceUrl())
                    .videoId(req.getVideoId())
                    .localMediaId(req.getLocalMediaId())
                    .quality(req.getQuality())
                    .channel(req.getChannel())
                    .build());
            Instant now = Instant.now();
            pl.setUpdatedAt(now);
            lib.setUpdatedAt(now);
            repository.save(lib);
        }
        return toPlaylist(pl);
    }

    public PlaylistDto removeTrack(String playlistId, String trackId) {
        UserLibrary lib = requireLibrary();
        LibraryPlaylist pl = findPlaylist(lib, playlistId);
        pl.getItems().removeIf(t -> trackId.equals(t.getId()));
        Instant now = Instant.now();
        pl.setUpdatedAt(now);
        lib.setUpdatedAt(now);
        repository.save(lib);
        return toPlaylist(pl);
    }

    public PlaylistDto reorderTracks(String playlistId, ReorderTracksRequest req) {
        UserLibrary lib = requireLibrary();
        LibraryPlaylist pl = findPlaylist(lib, playlistId);
        if (req != null && req.getTrackIds() != null) {
            Map<String, LibraryTrack> map = pl.getItems().stream()
                    .collect(Collectors.toMap(LibraryTrack::getId, t -> t, (a, b) -> a));
            List<LibraryTrack> next = new ArrayList<>();
            for (String id : req.getTrackIds()) {
                LibraryTrack t = map.remove(id);
                if (t != null) next.add(t);
            }
            next.addAll(map.values());
            pl.setItems(next);
        }
        Instant now = Instant.now();
        pl.setUpdatedAt(now);
        lib.setUpdatedAt(now);
        repository.save(lib);
        return toPlaylist(pl);
    }

    public List<FavoriteDto> listFavorites(String type) {
        UserLibrary lib = requireLibrary();
        return lib.getFavorites().stream()
                .filter(f -> type == null || type.equalsIgnoreCase(f.getType()))
                .map(this::toFavorite)
                .toList();
    }

    public boolean toggleFavorite(ToggleFavoriteRequest req) {
        if (req == null || isBlank(req.getVideoId()) || isBlank(req.getType())) {
            throw new IllegalArgumentException("videoId and type are required");
        }
        UserLibrary lib = requireLibrary();
        String id = req.getType() + ":" + req.getVideoId();
        boolean removed = lib.getFavorites().removeIf(f -> id.equals(f.getId()));
        if (!removed) {
            lib.getFavorites().add(0, LibraryFavorite.builder()
                    .id(id)
                    .videoId(req.getVideoId())
                    .title(req.getTitle() != null ? req.getTitle() : "Untitled")
                    .thumbnailUrl(req.getThumbnailUrl())
                    .channel(req.getChannel())
                    .sourceUrl(req.getSourceUrl())
                    .type(req.getType())
                    .addedAt(Instant.now())
                    .build());
        }
        lib.setUpdatedAt(Instant.now());
        repository.save(lib);
        return !removed;
    }

    public void removeFavorite(String id) {
        UserLibrary lib = requireLibrary();
        lib.getFavorites().removeIf(f -> id.equals(f.getId()));
        lib.setUpdatedAt(Instant.now());
        repository.save(lib);
    }

    public List<RecentDto> listRecent() {
        return requireLibrary().getRecent().stream().map(this::toRecent).toList();
    }

    public List<RecentDto> pushRecent(PushRecentRequest req) {
        if (req == null || isBlank(req.getTitle()) || isBlank(req.getType())) {
            throw new IllegalArgumentException("title and type are required");
        }
        UserLibrary lib = requireLibrary();
        String id = !isBlank(req.getLibraryId()) ? req.getLibraryId()
                : !isBlank(req.getVideoId()) ? req.getVideoId()
                : req.getType() + ":" + req.getTitle();
        lib.getRecent().removeIf(r -> id.equals(r.getId())
                || (req.getVideoId() != null && req.getVideoId().equals(r.getVideoId())
                && req.getType().equals(r.getType())));
        lib.getRecent().add(0, LibraryRecent.builder()
                .id(id)
                .title(req.getTitle())
                .thumbnailUrl(req.getThumbnailUrl())
                .type(req.getType())
                .streamUrl(req.getStreamUrl())
                .videoId(req.getVideoId())
                .sourceUrl(req.getSourceUrl())
                .libraryId(req.getLibraryId())
                .quality(req.getQuality())
                .playedAt(Instant.now())
                .build());
        if (lib.getRecent().size() > MAX_RECENT) {
            lib.setRecent(new ArrayList<>(lib.getRecent().subList(0, MAX_RECENT)));
        }
        lib.setUpdatedAt(Instant.now());
        repository.save(lib);
        return lib.getRecent().stream().map(this::toRecent).toList();
    }

    /** Merge local guest data into cloud library on login (cloud wins on conflicts by id). */
    public LibrarySnapshotDto migrate(MigrateLibraryRequest req) {
        UserLibrary lib = requireLibrary();
        Instant now = Instant.now();
        if (req != null) {
            if (req.getPlaylists() != null) {
                Map<String, LibraryPlaylist> existing = lib.getPlaylists().stream()
                        .collect(Collectors.toMap(LibraryPlaylist::getId, p -> p, (a, b) -> a));
                for (PlaylistDto dto : req.getPlaylists()) {
                    if (dto == null || isBlank(dto.getId()) || existing.containsKey(dto.getId())) continue;
                    lib.getPlaylists().add(fromPlaylistDto(dto));
                }
            }
            if (req.getFavorites() != null) {
                Map<String, LibraryFavorite> existing = lib.getFavorites().stream()
                        .collect(Collectors.toMap(LibraryFavorite::getId, f -> f, (a, b) -> a));
                for (FavoriteDto dto : req.getFavorites()) {
                    if (dto == null || isBlank(dto.getId()) || existing.containsKey(dto.getId())) continue;
                    lib.getFavorites().add(fromFavoriteDto(dto));
                }
            }
            if (req.getRecent() != null) {
                Map<String, LibraryRecent> existing = lib.getRecent().stream()
                        .collect(Collectors.toMap(LibraryRecent::getId, r -> r, (a, b) -> a));
                for (RecentDto dto : req.getRecent()) {
                    if (dto == null || isBlank(dto.getId()) || existing.containsKey(dto.getId())) continue;
                    lib.getRecent().add(0, fromRecentDto(dto));
                }
                if (lib.getRecent().size() > MAX_RECENT) {
                    lib.setRecent(new ArrayList<>(lib.getRecent().subList(0, MAX_RECENT)));
                }
            }
        }
        lib.setUpdatedAt(now);
        repository.save(lib);
        return toSnapshot(lib);
    }

    private UserLibrary requireLibrary() {
        AuthContext ctx = AuthContextHolder.get();
        if (ctx == null || isBlank(ctx.getUserId())) {
            throw new IllegalStateException("Authentication required for cloud library");
        }
        return repository.findByUserId(ctx.getUserId()).orElseGet(() ->
                repository.save(UserLibrary.builder()
                        .userId(ctx.getUserId())
                        .playlists(new ArrayList<>())
                        .favorites(new ArrayList<>())
                        .recent(new ArrayList<>())
                        .updatedAt(Instant.now())
                        .build()));
    }

    private LibraryPlaylist findPlaylist(UserLibrary lib, String id) {
        return lib.getPlaylists().stream()
                .filter(p -> id.equals(p.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Playlist not found"));
    }

    private String requireName(String name) {
        if (isBlank(name)) throw new IllegalArgumentException("Playlist name is required");
        return name.trim();
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private LibrarySnapshotDto toSnapshot(UserLibrary lib) {
        return LibrarySnapshotDto.builder()
                .playlists(lib.getPlaylists().stream().map(this::toPlaylist).toList())
                .favorites(lib.getFavorites().stream().map(this::toFavorite).toList())
                .recent(lib.getRecent().stream().map(this::toRecent).toList())
                .updatedAt(lib.getUpdatedAt() != null ? lib.getUpdatedAt().toString() : null)
                .build();
    }

    private PlaylistDto toPlaylist(LibraryPlaylist pl) {
        return PlaylistDto.builder()
                .id(pl.getId())
                .name(pl.getName())
                .createdAt(pl.getCreatedAt() != null ? pl.getCreatedAt().toString() : null)
                .updatedAt(pl.getUpdatedAt() != null ? pl.getUpdatedAt().toString() : null)
                .items(pl.getItems() == null ? List.of() : pl.getItems().stream().map(this::toTrack).toList())
                .build();
    }

    private TrackDto toTrack(LibraryTrack t) {
        return TrackDto.builder()
                .id(t.getId()).title(t.getTitle()).type(t.getType())
                .thumbnailUrl(t.getThumbnailUrl()).streamUrl(t.getStreamUrl())
                .sourceUrl(t.getSourceUrl()).videoId(t.getVideoId())
                .localMediaId(t.getLocalMediaId()).quality(t.getQuality()).channel(t.getChannel())
                .build();
    }

    private FavoriteDto toFavorite(LibraryFavorite f) {
        return FavoriteDto.builder()
                .id(f.getId()).videoId(f.getVideoId()).title(f.getTitle())
                .thumbnailUrl(f.getThumbnailUrl()).channel(f.getChannel())
                .sourceUrl(f.getSourceUrl()).type(f.getType())
                .addedAt(f.getAddedAt() != null ? f.getAddedAt().toString() : null)
                .build();
    }

    private RecentDto toRecent(LibraryRecent r) {
        return RecentDto.builder()
                .id(r.getId()).title(r.getTitle()).thumbnailUrl(r.getThumbnailUrl())
                .type(r.getType()).streamUrl(r.getStreamUrl()).videoId(r.getVideoId())
                .sourceUrl(r.getSourceUrl()).libraryId(r.getLibraryId()).quality(r.getQuality())
                .playedAt(r.getPlayedAt() != null ? r.getPlayedAt().toString() : null)
                .build();
    }

    private LibraryPlaylist fromPlaylistDto(PlaylistDto dto) {
        Instant created = parseInstant(dto.getCreatedAt());
        Instant updated = parseInstant(dto.getUpdatedAt());
        List<LibraryTrack> items = new ArrayList<>();
        if (dto.getItems() != null) {
            for (TrackDto t : dto.getItems()) {
                if (t == null) continue;
                items.add(LibraryTrack.builder()
                        .id(t.getId() != null ? t.getId() : "tr_" + UUID.randomUUID())
                        .title(t.getTitle()).type(t.getType())
                        .thumbnailUrl(t.getThumbnailUrl()).streamUrl(t.getStreamUrl())
                        .sourceUrl(t.getSourceUrl()).videoId(t.getVideoId())
                        .localMediaId(t.getLocalMediaId()).quality(t.getQuality()).channel(t.getChannel())
                        .build());
            }
        }
        return LibraryPlaylist.builder()
                .id(dto.getId()).name(dto.getName())
                .createdAt(created).updatedAt(updated).items(items)
                .build();
    }

    private LibraryFavorite fromFavoriteDto(FavoriteDto dto) {
        return LibraryFavorite.builder()
                .id(dto.getId()).videoId(dto.getVideoId()).title(dto.getTitle())
                .thumbnailUrl(dto.getThumbnailUrl()).channel(dto.getChannel())
                .sourceUrl(dto.getSourceUrl()).type(dto.getType())
                .addedAt(parseInstant(dto.getAddedAt()))
                .build();
    }

    private LibraryRecent fromRecentDto(RecentDto dto) {
        return LibraryRecent.builder()
                .id(dto.getId()).title(dto.getTitle()).thumbnailUrl(dto.getThumbnailUrl())
                .type(dto.getType()).streamUrl(dto.getStreamUrl()).videoId(dto.getVideoId())
                .sourceUrl(dto.getSourceUrl()).libraryId(dto.getLibraryId()).quality(dto.getQuality())
                .playedAt(parseInstant(dto.getPlayedAt()))
                .build();
    }

    private Instant parseInstant(String s) {
        if (isBlank(s)) return Instant.now();
        try {
            return Instant.parse(s);
        } catch (Exception e) {
            return Instant.now();
        }
    }
}
