import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@mediaface/search_history';
const MAX_ITEMS = 20;

export async function listSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addSearchHistory(query: string): Promise<void> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return;
  }
  const existing = await listSearchHistory();
  const next = [trimmed, ...existing.filter(q => q.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    MAX_ITEMS,
  );
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export async function removeSearchHistoryItem(query: string): Promise<void> {
  const existing = await listSearchHistory();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(existing.filter(q => q !== query)),
  );
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
