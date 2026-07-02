import AsyncStorage from '@react-native-async-storage/async-storage';
import {PlayableMedia} from '../api/client';

export interface RecentMediaEntry {
  id: string;
  title: string;
  thumbnailUrl?: string;
  type: 'AUDIO' | 'VIDEO';
  streamUrl?: string;
  videoId?: string;
  sourceUrl?: string;
  libraryId?: string;
}

const STORAGE_KEY = '@mediaface/recent_media';
const MAX_ITEMS = 12;

export async function loadRecentMedia(): Promise<RecentMediaEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RecentMediaEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function pushRecentMedia(media: PlayableMedia, streamUrl: string): Promise<void> {
  try {
    const id =
      media.libraryId ||
      media.videoId ||
      `${media.type}:${media.title}:${streamUrl}`;
    const entry: RecentMediaEntry = {
      id,
      title: media.title,
      thumbnailUrl: media.thumbnailUrl,
      type: media.type,
      streamUrl,
      videoId: media.videoId,
      sourceUrl: media.sourceUrl,
      libraryId: media.libraryId,
    };
    const existing = await loadRecentMedia();
    const next = [entry, ...existing.filter(item => item.id !== id)].slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence errors
  }
}
