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
import {QualityPickerSheet, QualityAction} from '../../components/QualityPickerSheet';
import {usePlayback} from '../../context/PlaybackContext';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import {useFeatureFlag} from '../../core/features/FeatureFlagsProvider';
import type {MediaSearchResult} from '../../features/media/domain/types';
import type {AudioQuality, MediaQuality, VideoQuality} from '../../features/media/domain/qualityPresets';
import {qualityLabel} from '../../features/media/domain/qualityPresets';
import {useMediaSearch} from '../../features/media/hooks/useMediaSearch';
import {prepareAndStartPlayback, showDownloadError} from '../../features/media/services/PlaybackOrchestrator';
import {downloadSearchItemToDevice} from '../../utils/localMediaStore';
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
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState<Record<string, 'AUDIO' | 'VIDEO'>>({});
  const [pickerItem, setPickerItem] = useState<MediaSearchResult | null>(null);
  const [pickerType, setPickerType] = useState<'AUDIO' | 'VIDEO'>('AUDIO');
  const [pickerAction, setPickerAction] = useState<QualityAction>('play');

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingSearchQuery();
      if (pending) {
        setQuery(pending);
      }
    }, [setQuery]),
  );

  const openPicker = (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO', action: QualityAction) => {
    if (action === 'play' && !mediaSearchEnabled) {
      Alert.alert('Unavailable', 'Media search is disabled on this server.');
      return;
    }
    if (action === 'download' && !mediaDownloadEnabled) {
      Alert.alert('Unavailable', 'Downloads are disabled on this server.');
      return;
    }
    setPickerItem(item);
    setPickerType(type);
    setPickerAction(action);
  };

  const runPlay = (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO', quality: MediaQuality) => {
    prefetchMediaPrepare(item.videoId, type);
    setPlaying(prev => ({...prev, [item.videoId]: type}));
    void prepareAndStartPlayback(item, type, playback, undefined, quality)
      .catch(() => undefined)
      .finally(() => {
        setPlaying(prev => {
          const next = {...prev};
          delete next[item.videoId];
          return next;
        });
      });
  };

  const runDownload = (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO', quality: MediaQuality) => {
    void warmMediaServer();
    prefetchMediaPrepare(item.videoId, type);
    setDownloading(prev => ({...prev, [item.videoId]: type}));
    setDownloadProgress(prev => ({...prev, [item.videoId]: 0}));
    void downloadSearchItemToDevice(
      item,
      type,
      progress => {
        setDownloadProgress(prev => ({...prev, [item.videoId]: progress.percent}));
      },
      quality,
    )
      .then(() => {
        Alert.alert(
          'Saved on device',
          `${qualityLabel(type, quality)} saved to My Downloads.`,
        );
      })
      .catch(e => showDownloadError(e))
      .finally(() => {
        setDownloading(prev => {
          const next = {...prev};
          delete next[item.videoId];
          return next;
        });
        setDownloadProgress(prev => {
          const next = {...prev};
          delete next[item.videoId];
          return next;
        });
      });
  };

  const handlePickerConfirm = (quality: AudioQuality | VideoQuality) => {
    if (!pickerItem) {
      return;
    }
    const item = pickerItem;
    const type = pickerType;
    const action = pickerAction;
    setPickerItem(null);
    if (action === 'play') {
      runPlay(item, type, quality);
    } else {
      runDownload(item, type, quality);
    }
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
              subtitle="Type at least 2 characters — pick MP3 or HD quality when you play or save"
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
            downloadProgress={downloadProgress[item.videoId] ?? null}
            playing={playing[item.videoId] || null}
            onPress={() => openPicker(item, 'AUDIO', 'play')}
            onPressIn={() => {
              prefetchMediaPrepare(item.videoId, 'AUDIO');
              prefetchMediaPrepare(item.videoId, 'VIDEO');
            }}
            onPlayAudio={() => openPicker(item, 'AUDIO', 'play')}
            onPlayVideo={() => openPicker(item, 'VIDEO', 'play')}
            onDownloadAudio={() => openPicker(item, 'AUDIO', 'download')}
            onDownloadVideo={() => openPicker(item, 'VIDEO', 'download')}
          />
        )}
        contentContainerStyle={
          results.length === 0 && !loading
            ? [styles.emptyList, {paddingBottom: layout.contentBottomPadWithPlayer}]
            : [styles.list, {paddingBottom: layout.contentBottomPadWithPlayer}]
        }
      />

      <QualityPickerSheet
        visible={pickerItem != null}
        item={pickerItem}
        mediaType={pickerType}
        action={pickerAction}
        onClose={() => setPickerItem(null)}
        onConfirm={handlePickerConfirm}
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
