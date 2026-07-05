import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MediaType} from '../features/media/domain/types';

export interface PlaylistTrack {
  id: string;
  title: string;
  type: MediaType;
  thumbnailUrl?: string;
  streamUrl?: string;
  sourceUrl?: string;
  videoId?: string;
  localMediaId?: string;
  quality?: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: PlaylistTrack[];
}

const STORAGE_KEY = '@mediaface/playlists';

function newId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadAll(): Promise<Playlist[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Playlist[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(playlists: Playlist[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
}

export async function listPlaylists(): Promise<Playlist[]> {
  const items = await loadAll();
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  const items = await loadAll();
  return items.find(p => p.id === id) ?? null;
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Playlist name is required');
  }
  const now = new Date().toISOString();
  const playlist: Playlist = {
    id: newId(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    items: [],
  };
  const items = await loadAll();
  await saveAll([playlist, ...items]);
  return playlist;
}

export async function renamePlaylist(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Playlist name is required');
  }
  const items = await loadAll();
  const idx = items.findIndex(p => p.id === id);
  if (idx < 0) {
    throw new Error('Playlist not found');
  }
  items[idx] = {...items[idx], name: trimmed, updatedAt: new Date().toISOString()};
  await saveAll(items);
}

export async function deletePlaylist(id: string): Promise<void> {
  const items = await loadAll();
  await saveAll(items.filter(p => p.id !== id));
}

export async function addTrackToPlaylist(
  playlistId: string,
  track: Omit<PlaylistTrack, 'id'>,
): Promise<void> {
  const items = await loadAll();
  const idx = items.findIndex(p => p.id === playlistId);
  if (idx < 0) {
    throw new Error('Playlist not found');
  }
  const playlist = items[idx];
  const duplicate = playlist.items.some(
    t =>
      (track.videoId && t.videoId === track.videoId && t.type === track.type) ||
      (track.localMediaId && t.localMediaId === track.localMediaId),
  );
  if (duplicate) {
    return;
  }
  const nextTrack: PlaylistTrack = {...track, id: newId()};
  items[idx] = {
    ...playlist,
    items: [...playlist.items, nextTrack],
    updatedAt: new Date().toISOString(),
  };
  await saveAll(items);
}

export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const items = await loadAll();
  const idx = items.findIndex(p => p.id === playlistId);
  if (idx < 0) {
    return;
  }
  const playlist = items[idx];
  items[idx] = {
    ...playlist,
    items: playlist.items.filter(t => t.id !== trackId),
    updatedAt: new Date().toISOString(),
  };
  await saveAll(items);
}

export async function reorderPlaylistTracks(
  playlistId: string,
  trackIds: string[],
): Promise<void> {
  const items = await loadAll();
  const idx = items.findIndex(p => p.id === playlistId);
  if (idx < 0) {
    return;
  }
  const playlist = items[idx];
  const map = new Map(playlist.items.map(t => [t.id, t]));
  const reordered = trackIds.map(id => map.get(id)).filter((t): t is PlaylistTrack => !!t);
  items[idx] = {...playlist, items: reordered, updatedAt: new Date().toISOString()};
  await saveAll(items);
}
