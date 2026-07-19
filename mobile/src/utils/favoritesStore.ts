import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MediaSearchResult} from '../features/media/domain/types';
import {getAuthToken} from './authStorage';
import {httpRequest} from '../core/api/httpClient';

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

const STORAGE_KEY = '@mediaface/favorites';

function favoriteId(videoId: string, type: 'AUDIO' | 'VIDEO'): string {
  return `${type}:${videoId}`;
}

async function loadAll(): Promise<FavoriteItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FavoriteItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(items: FavoriteItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function listFavorites(type?: 'AUDIO' | 'VIDEO'): Promise<FavoriteItem[]> {
  const items = await loadAll();
  const filtered = type ? items.filter(i => i.type === type) : items;
  return filtered.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export async function isFavorite(videoId: string, type: 'AUDIO' | 'VIDEO'): Promise<boolean> {
  const items = await loadAll();
  return items.some(i => i.id === favoriteId(videoId, type));
}

export async function toggleFavorite(
  item: MediaSearchResult,
  type: 'AUDIO' | 'VIDEO',
): Promise<boolean> {
  const id = favoriteId(item.videoId, type);
  const items = await loadAll();
  const exists = items.some(i => i.id === id);
  if (exists) {
    await saveAll(items.filter(i => i.id !== id));
  } else {
    const next: FavoriteItem = {
      id,
      videoId: item.videoId,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      channel: item.channel,
      sourceUrl: item.sourceUrl,
      type,
      addedAt: new Date().toISOString(),
    };
    await saveAll([next, ...items]);
  }
  if (await getAuthToken()) {
    void httpRequest<{favorited: boolean}>('/api/library/favorites/toggle', {
      method: 'POST',
      body: JSON.stringify({
        videoId: item.videoId,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl,
        channel: item.channel,
        sourceUrl: item.sourceUrl,
        type,
      }),
    }).catch(() => undefined);
  }
  return !exists;
}

export async function removeFavorite(id: string): Promise<void> {
  const items = await loadAll();
  await saveAll(items.filter(i => i.id !== id));
  if (await getAuthToken()) {
    void httpRequest(`/api/library/favorites/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }).catch(() => undefined);
  }
}

export function favoriteFromSearch(item: MediaSearchResult, type: 'AUDIO' | 'VIDEO'): FavoriteItem {
  return {
    id: favoriteId(item.videoId, type),
    videoId: item.videoId,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    channel: item.channel,
    sourceUrl: item.sourceUrl,
    type,
    addedAt: new Date().toISOString(),
  };
}

export async function pullCloudFavorites(): Promise<void> {
  if (!(await getAuthToken())) return;
  try {
    const res = await httpRequest<FavoriteItem[]>('/api/library/favorites');
    if (res.success && Array.isArray(res.data)) {
      await saveAll(res.data);
    }
  } catch {
    // keep local
  }
}
