import type {PlayableMedia} from '../types/media';
import {loadJson, saveJson} from './storage';

export interface RecentEntry {
  media: PlayableMedia;
  streamUrl: string;
  playedAt: string;
}

const KEY = 'mediaface:recent';
const MAX = 30;

export function listRecent(): RecentEntry[] {
  return loadJson<RecentEntry[]>(KEY, []);
}

export function pushRecent(media: PlayableMedia, streamUrl: string) {
  const entry: RecentEntry = {media, streamUrl, playedAt: new Date().toISOString()};
  const next = [
    entry,
    ...listRecent().filter(
      r => r.media.videoId !== media.videoId || r.media.type !== media.type,
    ),
  ].slice(0, MAX);
  saveJson(KEY, next);
}
