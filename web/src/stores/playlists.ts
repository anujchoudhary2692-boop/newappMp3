import type {MediaType} from '../types/media';
import {loadJson, saveJson} from './storage';
import {getAuthToken} from '../utils/auth';
import {api} from '../api/client';

export interface PlaylistTrack {
  id: string;
  title: string;
  type: MediaType;
  thumbnailUrl?: string;
  sourceUrl?: string;
  videoId?: string;
  quality?: string;
  streamUrl?: string;
  channel?: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: PlaylistTrack[];
}

const KEY = 'mediaface:playlists';

function load(): Playlist[] {
  return loadJson<Playlist[]>(KEY, []);
}

function save(items: Playlist[]) {
  saveJson(KEY, items);
}

function cloud(): boolean {
  return !!getAuthToken();
}

export function listPlaylists(): Playlist[] {
  return load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPlaylist(id: string): Playlist | null {
  return load().find(p => p.id === id) ?? null;
}

export function createPlaylist(name: string): Playlist {
  const now = new Date().toISOString();
  const pl: Playlist = {
    id: `pl_${Date.now()}`,
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    items: [],
  };
  save([pl, ...load()]);
  if (cloud()) {
    void api.libraryCreatePlaylist(name.trim()).then(res => {
      const remote = res.data as unknown as Playlist;
      if (remote?.id) {
        save(load().map(p => (p.id === pl.id ? {...remote, items: remote.items || []} : p)));
      }
    }).catch(() => undefined);
  }
  return pl;
}

export function renamePlaylist(id: string, name: string) {
  save(
    load().map(p =>
      p.id === id ? {...p, name: name.trim(), updatedAt: new Date().toISOString()} : p,
    ),
  );
  if (cloud()) {
    void api.libraryRenamePlaylist(id, name.trim()).catch(() => undefined);
  }
}

export function deletePlaylist(id: string) {
  save(load().filter(p => p.id !== id));
  if (cloud()) {
    void api.libraryDeletePlaylist(id).catch(() => undefined);
  }
}

export function addToPlaylist(playlistId: string, track: Omit<PlaylistTrack, 'id'>) {
  const items = load();
  const pl = items.find(p => p.id === playlistId);
  if (!pl) return;
  const next = {...track, id: `tr_${Date.now()}`};
  pl.items.push(next);
  pl.updatedAt = new Date().toISOString();
  save(items);
  if (cloud()) {
    void api.libraryAddTrack(playlistId, track).catch(() => undefined);
  }
}

export function removeFromPlaylist(playlistId: string, trackId: string) {
  const items = load();
  const pl = items.find(p => p.id === playlistId);
  if (!pl) return;
  pl.items = pl.items.filter(t => t.id !== trackId);
  pl.updatedAt = new Date().toISOString();
  save(items);
  if (cloud()) {
    void api.libraryRemoveTrack(playlistId, trackId).catch(() => undefined);
  }
}

export function reorderPlaylist(playlistId: string, from: number, to: number) {
  const items = load();
  const pl = items.find(p => p.id === playlistId);
  if (!pl) return;
  const [moved] = pl.items.splice(from, 1);
  pl.items.splice(to, 0, moved);
  pl.updatedAt = new Date().toISOString();
  save(items);
}
