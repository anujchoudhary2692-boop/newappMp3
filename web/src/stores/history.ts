import {loadJson, saveJson} from './storage';

const KEY = 'mediaface:search_history';
const MAX = 20;

export function listHistory(): string[] {
  return loadJson<string[]>(KEY, []);
}

export function addHistory(q: string) {
  const trimmed = q.trim();
  if (trimmed.length < 2) return;
  const next = [trimmed, ...listHistory().filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX,
  );
  saveJson(KEY, next);
}

export function removeHistory(q: string) {
  saveJson(KEY, listHistory().filter(h => h !== q));
}
