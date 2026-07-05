import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MediaSearchResult} from '../features/media/domain/types';

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
    if (!raw) {
      return [];
    }
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
    return false;
  }
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
  return true;
}

export async function removeFavorite(id: string): Promise<void> {
  const items = await loadAll();
  await saveAll(items.filter(i => i.id !== id));
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
