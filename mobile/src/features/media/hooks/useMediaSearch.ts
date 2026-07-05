import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert} from 'react-native';
import {ensureApiServer, wakeCloudServer} from '../../../core/api/httpClient';
import {isProductionMode} from '../../../config';
import {connectionErrorHint, isRecoverableRequestError} from '../../../utils/serverConnection';
import {prefetchSearchResults, warmMediaServer} from '../../../utils/mediaPrefetch';
import {getCachedSearch, setCachedSearch} from '../../../utils/searchCache';
import {addSearchHistory} from '../../../utils/searchHistoryStore';
import {mediaApi} from '../api/mediaApi';
import type {MediaSearchResult} from '../domain/types';

export function useMediaSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const search = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q || q.length < 2) {
      return;
    }

    const cached = getCachedSearch<MediaSearchResult[]>(q);
    if (cached) {
      setResults(cached);
      prefetchSearchResults(cached);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++seqRef.current;

    setLoading(true);
    try {
      await ensureApiServer();
      if (isProductionMode()) {
        void warmMediaServer().catch(() => undefined);
      }
      let response = await mediaApi.search(q, controller.signal);
      if (seq !== seqRef.current) {
        return;
      }
      if (response.success) {
        const data = response.data || [];
        setResults(data);
        setCachedSearch(q, data);
        prefetchSearchResults(data);
        void addSearchHistory(q);
        return;
      }
      Alert.alert('Search failed', response.message || 'Try again');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (seq !== seqRef.current) {
        return;
      }

      if (isRecoverableRequestError(error) && isProductionMode()) {
        const awake = await wakeCloudServer(90000);
        if (awake && seq === seqRef.current) {
          try {
            const retry = await mediaApi.search(q, controller.signal);
            if (retry.success) {
              const data = retry.data || [];
              setResults(data);
              setCachedSearch(q, data);
              prefetchSearchResults(data);
              void addSearchHistory(q);
              return;
            }
          } catch {
            // fall through to alert
          }
        }
      }

      Alert.alert('Connection error', connectionErrorHint());
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
      }
    }
  }, [query]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  return {query, setQuery, results, loading, search};
}
