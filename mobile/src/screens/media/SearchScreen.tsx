import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import {SearchBar} from '../../components/SearchBar';
import {MediaCard, formatDuration} from '../../components/MediaCard';
import {EmptyState} from '../../components/EmptyState';
import {MediaListSkeleton} from '../../components/Skeleton';
import {usePlayback} from '../../context/PlaybackContext';
import {api, MediaSearchResult} from '../../api/client';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import {connectionErrorHint} from '../../utils/serverConnection';
import {
  prepareAndStartPlayback,
  saveSearchItemToDevice,
  showDownloadError,
  showPlaybackError,
} from '../../utils/playSearchItem';
import {getCachedSearch, setCachedSearch} from '../../utils/searchCache';
import {consumePendingSearchQuery} from '../../utils/searchIntent';
import {useLayoutMetrics} from '../../utils/layout';
import {enterpriseStyles} from '../../theme/enterprise';

const QUICK_SEARCHES = [
  'Trending songs',
  'Bollywood hits',
  'Lo-fi beats',
  'Pop music 2024',
  'Music video HD',
  'Chill playlist',
];

export function SearchScreen() {
  const {play: startPlayback} = usePlayback();
  const layout = useLayoutMetrics(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<Record<string, 'AUDIO' | 'VIDEO'>>({});
  const [playing, setPlaying] = useState<Record<string, 'AUDIO' | 'VIDEO'>>({});
  const [preparing, setPreparing] = useState<{title: string; message: string} | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchSeqRef = useRef(0);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q || q.length < 2) {
      return;
    }

    const cached = getCachedSearch<MediaSearchResult[]>(q);
    if (cached) {
      setResults(cached);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const seq = ++searchSeqRef.current;

    setLoading(true);
    try {
      const response = await api.searchMedia(q, controller.signal);
      if (seq !== searchSeqRef.current) {
        return;
      }
      if (response.success) {
        const data = response.data || [];
        setResults(data);
        setCachedSearch(q, data);
      } else {
        Alert.alert('Search failed', response.message || 'Try again');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      if (seq === searchSeqRef.current) {
        Alert.alert('Connection error', connectionErrorHint());
      }
    } finally {
      if (seq === searchSeqRef.current) {
        setLoading(false);
      }
    }
  }, [query]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingSearchQuery();
      if (pending) {
        setQuery(pending);
      }
    }, []),
  );

  const handlePlay = async (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO') => {
    setPlaying(prev => ({...prev, [item.videoId]: type}));
    setPreparing({
      title: item.title,
      message: type === 'AUDIO' ? 'Starting audio…' : 'Starting video…',
    });
    try {
      await prepareAndStartPlayback(item, type, startPlayback, message => {
        if (message) {
          setPreparing(prev =>
            prev ? {...prev, message} : {title: item.title, message},
          );
        }
      });
    } catch (e) {
      showPlaybackError(e);
    } finally {
      setPreparing(null);
      setPlaying(prev => {
        const next = {...prev};
        delete next[item.videoId];
        return next;
      });
    }
  };

  const handleDownload = async (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO') => {
    setDownloading(prev => ({...prev, [item.videoId]: type}));
    try {
      await saveSearchItemToDevice(item, type);
      Alert.alert(
        'Saved on device',
        type === 'AUDIO'
          ? 'Audio saved to your phone storage and cloud library.'
          : 'Video saved to your phone storage and cloud library.',
      );
    } catch (e) {
      showDownloadError(e);
    } finally {
      setDownloading(prev => {
        const next = {...prev};
        delete next[item.videoId];
        return next;
      });
    }
  };

  return (
    <View style={enterpriseStyles.page}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onSearch={() => handleSearch()}
        loading={loading}
        placeholder="Search any song, artist, music video..."
      />

      {results.length === 0 && !loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsWrap}>
          {QUICK_SEARCHES.map(q => (
            <TouchableOpacity key={q} style={styles.chip} onPress={() => setQuery(q)}>
              <Icon name="flash" size={14} color={COLORS.primary} />
              <Text style={styles.chipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={item => item.videoId}
        refreshControl={
          <RefreshControl refreshing={loading && results.length > 0} onRefresh={() => handleSearch()} tintColor={COLORS.primary} />
        }
        ListHeaderComponent={
          loading && results.length === 0 ? <MediaListSkeleton count={6} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="search-outline"
              title="Search any song or video"
              subtitle="Type at least 2 characters — results appear automatically"
              accentColor={COLORS.primary}
            />
          ) : null
        }
        renderItem={({item}) => (
          <MediaCard
            title={item.title}
            subtitle={
              item.durationSeconds
                ? `${item.channel} · ${formatDuration(item.durationSeconds)}`
                : item.channel
            }
            thumbnailUrl={item.thumbnailUrl}
            audioFormat={item.audioFormat}
            videoFormat={item.videoFormat}
            mode="search"
            downloading={downloading[item.videoId] || null}
            playing={playing[item.videoId] || null}
            onPress={() => handlePlay(item, 'AUDIO')}
            onPlayAudio={() => handlePlay(item, 'AUDIO')}
            onPlayVideo={() => handlePlay(item, 'VIDEO')}
            onDownloadAudio={() => handleDownload(item, 'AUDIO')}
            onDownloadVideo={() => handleDownload(item, 'VIDEO')}
          />
        )}
        contentContainerStyle={
          results.length === 0 && !loading
            ? [styles.emptyList, {paddingBottom: layout.contentBottomPadWithPlayer}]
            : [styles.list, {paddingBottom: layout.contentBottomPadWithPlayer}]
        }
      />

      <Modal visible={!!preparing} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, {maxWidth: layout.modalMaxWidth}]}>
            <Icon name="hourglass-outline" size={36} color={COLORS.primary} />
            <Text style={[styles.modalTitle, {fontSize: layout.font.lg}]} numberOfLines={2}>
              {preparing?.title}
            </Text>
            <Text style={[styles.modalSub, {fontSize: layout.font.sm, lineHeight: layout.font.lineMd}]}>
              {preparing?.message}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  chipsWrap: {maxHeight: 48, marginBottom: SPACING.xs},
  chips: {paddingHorizontal: SPACING.md, gap: SPACING.sm},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.lg,
    backgroundColor: ENTERPRISE.searchBg,
    borderWidth: 1,
    borderColor: ENTERPRISE.searchBorder,
  },
  chipText: {color: '#E3E6E6', fontWeight: '700', fontSize: 13},
  list: {},
  emptyList: {flexGrow: 1},
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: SPACING.md},
  modalSub: {color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: 'center'},
});
