import type {MediaSearchResult} from '../types/media';
import {loadJson, saveJson} from './storage';

export interface FavoriteItem {
  id: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channel: string;
  sourceUrl: string;
  type: 'AUDIO' | 'VIDEO';
  addedAt: string;
}

const KEY = 'mediaface:favorites';

function fid(videoId: string, type: string) {
  return `${type}:${videoId}`;
}

export function listFavorites(type?: 'AUDIO' | 'VIDEO'): FavoriteItem[] {
  const items = loadJson<FavoriteItem[]>(KEY, []);
  return (type ? items.filter(i => i.type === type) : items).sort((a, b) =>
    b.addedAt.localeCompare(a.addedAt),
  );
}

export function toggleFavorite(item: MediaSearchResult, type: 'AUDIO' | 'VIDEO'): boolean {
  const id = fid(item.videoId, type);
  const items = loadJson<FavoriteItem[]>(KEY, []);
  if (items.some(i => i.id === id)) {
    saveJson(KEY, items.filter(i => i.id !== id));
    return false;
  }
  items.unshift({
    id,
    videoId: item.videoId,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    channel: item.channel,
    sourceUrl: item.sourceUrl,
    type,
    addedAt: new Date().toISOString(),
  });
  saveJson(KEY, items);
  return true;
}

export function isFavorite(videoId: string, type: 'AUDIO' | 'VIDEO'): boolean {
  return loadJson<FavoriteItem[]>(KEY, []).some(i => i.id === fid(videoId, type));
}
