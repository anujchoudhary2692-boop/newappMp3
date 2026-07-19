import {getAuthToken} from '../utils/auth';
import {api} from '../api/client';
import type {Playlist} from './playlists';
import {listPlaylists as localPlaylists} from './playlists';
import {listFavorites as localFavorites} from './favorites';
import {listRecent as localRecent} from './recent';
import {saveJson} from './storage';

export function isCloudLibraryEnabled(): boolean {
  return !!getAuthToken();
}

interface CloudRecent {
  id: string;
  title: string;
  thumbnailUrl?: string;
  type: string;
  streamUrl?: string;
  videoId?: string;
  sourceUrl?: string;
  libraryId?: string;
  quality?: string;
  playedAt?: string;
}

export async function pullCloudLibrary(): Promise<boolean> {
  if (!isCloudLibraryEnabled()) return false;
  try {
    const res = await api.librarySnapshot();
    const data = res.data;
    saveJson('mediaface:cloudLibraryCache', data);
    saveJson('mediaface:playlists', data.playlists || []);
    saveJson('mediaface:favorites', data.favorites || []);
    const recentRaw = (data.recent || []) as unknown as CloudRecent[];
    const recent = recentRaw.map(r => ({
      media: {
        title: r.title,
        type: (r.type === 'VIDEO' ? 'VIDEO' : 'AUDIO') as 'AUDIO' | 'VIDEO',
        streamUrl: r.streamUrl || '',
        thumbnailUrl: r.thumbnailUrl,
        quality: r.quality,
        sourceUrl: r.sourceUrl,
        videoId: r.videoId,
        libraryId: r.libraryId,
      },
      streamUrl: r.streamUrl || '',
      playedAt: r.playedAt || new Date().toISOString(),
    }));
    saveJson('mediaface:recent', recent);
    return true;
  } catch {
    return false;
  }
}

export async function migrateLocalLibraryToCloud(): Promise<boolean> {
  if (!isCloudLibraryEnabled()) return false;
  try {
    const playlists = localPlaylists();
    const favorites = localFavorites();
    const recent = localRecent().map(r => ({
      id: r.media.libraryId || r.media.videoId || `${r.media.type}:${r.media.title}`,
      title: r.media.title,
      thumbnailUrl: r.media.thumbnailUrl,
      type: r.media.type,
      streamUrl: r.streamUrl,
      videoId: r.media.videoId,
      sourceUrl: r.media.sourceUrl,
      libraryId: r.media.libraryId,
      quality: r.media.quality,
      playedAt: r.playedAt,
    }));
    await api.libraryMigrate({playlists, favorites, recent});
    await pullCloudLibrary();
    return true;
  } catch {
    return false;
  }
}

export type {Playlist};
