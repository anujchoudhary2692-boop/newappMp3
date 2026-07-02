const CACHE = new Map<string, {results: unknown; expiresAt: number}>();
const TTL_MS = 5 * 60 * 1000;
const MAX = 40;

function key(query: string): string {
  return query.trim().toLowerCase();
}

export function getCachedSearch<T>(query: string): T | null {
  const entry = CACHE.get(key(query));
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key(query));
    return null;
  }
  return entry.results as T;
}

export function setCachedSearch<T>(query: string, results: T): void {
  if (CACHE.size >= MAX) {
    CACHE.clear();
  }
  CACHE.set(key(query), {results, expiresAt: Date.now() + TTL_MS});
}
