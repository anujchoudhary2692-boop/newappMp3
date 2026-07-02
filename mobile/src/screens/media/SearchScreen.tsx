import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
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
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import {useFeatureFlag} from '../../core/features/FeatureFlagsProvider';
import type {MediaSearchResult} from '../../features/media/domain/types';
import {useMediaSearch} from '../../features/media/hooks/useMediaSearch';
import {prepareAndStartPlayback, saveSearchItemToDevice, showDownloadError} from '../../features/media/services/PlaybackOrchestrator';
import {prefetchMediaPrepare, warmMediaServer} from '../../utils/mediaPrefetch';
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
  const playback = usePlayback();
  const layout = useLayoutMetrics(true);
  const mediaSearchEnabled = useFeatureFlag('mediaSearch');
  const mediaDownloadEnabled = useFeatureFlag('mediaDownload');
  const {query, setQuery, results, loading, search} = useMediaSearch();
  const [downloading, setDownloading] = useState<Record<string, 'AUDIO' | 'VIDEO'>>({});
  const [playing, setPlaying] = useState<Record<string, 'AUDIO' | 'VIDEO'>>({});

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingSearchQuery();
      if (pending) {
        setQuery(pending);
      }
    }, [setQuery]),
  );

  const handlePlay = (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO') => {
    if (!mediaSearchEnabled) {
      Alert.alert('Unavailable', 'Media search is disabled on this server.');
      return;
    }
    prefetchMediaPrepare(item.videoId, type);
    setPlaying(prev => ({...prev, [item.videoId]: type}));
    void prepareAndStartPlayback(item, type, playback)
      .catch(() => {
        // error alert shown in prepareAndStartPlayback
      })
      .finally(() => {
        setPlaying(prev => {
          const next = {...prev};
          delete next[item.videoId];
          return next;
        });
      });
  };

  const handleDownload = (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO') => {
    if (!mediaDownloadEnabled) {
      Alert.alert('Unavailable', 'Downloads are disabled on this server.');
      return;
    }
    void warmMediaServer();
    prefetchMediaPrepare(item.videoId, type);
    setDownloading(prev => ({...prev, [item.videoId]: type}));
    void saveSearchItemToDevice(item, type)
      .then(() => {
        Alert.alert(
          'Saved on device',
          type === 'AUDIO'
            ? 'Audio saved to your phone storage and cloud library.'
            : 'Video saved to your phone storage and cloud library.',
        );
      })
      .catch(e => {
        showDownloadError(e);
      })
      .finally(() => {
        setDownloading(prev => {
          const next = {...prev};
          delete next[item.videoId];
          return next;
        });
      });
  };

  return (
    <View style={enterpriseStyles.page}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onSearch={() => search()}
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
          <RefreshControl refreshing={loading && results.length > 0} onRefresh={() => search()} tintColor={COLORS.primary} />
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
});
