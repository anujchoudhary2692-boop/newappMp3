import React, {useCallback, useState} from 'react';
import {
  Alert,
  Clipboard,
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
import {PlaylistPickerSheet} from '../../components/media/PlaylistPickerSheet';
import {usePlayback} from '../../context/PlaybackContext';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import {useFeatureFlag} from '../../core/features/FeatureFlagsProvider';
import type {MediaSearchResult} from '../../features/media/domain/types';
import type {AudioQuality, MediaQuality, VideoQuality} from '../../features/media/domain/qualityPresets';
import {qualityLabel} from '../../features/media/domain/qualityPresets';
import {useMediaSearch} from '../../features/media/hooks/useMediaSearch';
import {prepareAndStartPlayback, prepareQueueTrack, showDownloadError} from '../../features/media/services/PlaybackOrchestrator';
import {downloadSearchItemToDevice} from '../../utils/localMediaStore';
import {prefetchMediaPrepare, warmMediaServer} from '../../utils/mediaPrefetch';
import {consumePendingSearchQuery} from '../../utils/searchIntent';
import {listSearchHistory, removeSearchHistoryItem} from '../../utils/searchHistoryStore';
import {enqueueDownload} from '../../utils/downloadQueueStore';
import {DownloadQueueBar} from '../../components/media/DownloadQueueBar';
import {listFavorites, toggleFavorite} from '../../utils/favoritesStore';
import {
  addTrackToPlaylist,
  createPlaylist,
  listPlaylists,
  type Playlist,
} from '../../utils/playlistStore';
import {useLayoutMetrics} from '../../utils/layout';
import {extractYouTubeVideoId, youTubeWatchUrl} from '../../utils/youtubeUrl';
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
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [playlistTarget, setPlaylistTarget] = useState<MediaSearchResult | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Set<string>>(new Set());
  const [batchPickerType, setBatchPickerType] = useState<'AUDIO' | 'VIDEO'>('AUDIO');

  const loadFavorites = useCallback(async () => {
    const favs = await listFavorites();
    setFavoriteIds(new Set(favs.map(f => f.id)));
  }, []);

  const loadHistory = useCallback(async () => {
    setHistory(await listSearchHistory());
  }, []);

  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingSearchQuery();
      if (pending) {
        setQuery(pending);
      }
      loadFavorites();
      loadHistory();
    }, [setQuery, loadFavorites, loadHistory]),
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
    prefetchMediaPrepare(item.videoId, type, quality);
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

  const runQueue = (item: MediaSearchResult, type: 'AUDIO' | 'VIDEO', mode: 'next' | 'end') => {
    if (!mediaSearchEnabled) {
      Alert.alert('Unavailable', 'Media search is disabled on this server.');
      return;
    }
    setPlaying(prev => ({...prev, [item.videoId]: type}));
    void prepareQueueTrack(item, type)
      .then(track => {
        if (mode === 'next') {
          playback.insertNextTrack(track);
          Alert.alert('Queued', 'Will play next');
        } else {
          playback.enqueueTrack(track);
          Alert.alert('Queued', 'Added to end of queue');
        }
      })
      .catch(e => Alert.alert('Queue failed', e instanceof Error ? e.message : 'Error'))
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
    } else if (batchMode && selectedBatch.size > 0) {
      const targets = results.filter(r => selectedBatch.has(r.videoId));
      targets.forEach(t => enqueueDownload(t, type, quality));
      Alert.alert('Queued', `${targets.length} download(s) added to queue`);
      setSelectedBatch(new Set());
    } else {
      runDownload(item, type, quality);
    }
  };

  const toggleBatchSelect = (videoId: string) => {
    setSelectedBatch(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const queueBatchDownloads = () => {
    const targets = results.filter(r => selectedBatch.has(r.videoId));
    if (targets.length === 0) {
      Alert.alert('Select items', 'Turn on Batch mode and select search results first.');
      return;
    }
    setPickerItem(targets[0]);
    setPickerType(batchPickerType);
    setPickerAction('download');
  };

  const handleToggleFavorite = async (item: MediaSearchResult) => {
    const added = await toggleFavorite(item, 'AUDIO');
    setFavoriteIds(prev => {
      const next = new Set(prev);
      const id = `AUDIO:${item.videoId}`;
      if (added) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const openPlaylistPicker = async (item: MediaSearchResult) => {
    setPlaylists(await listPlaylists());
    setPlaylistTarget(item);
  };

  const addSearchToPlaylist = async (playlistId: string) => {
    if (!playlistTarget) {
      return;
    }
    await addTrackToPlaylist(playlistId, {
      title: playlistTarget.title,
      type: 'AUDIO',
      thumbnailUrl: playlistTarget.thumbnailUrl,
      sourceUrl: playlistTarget.sourceUrl,
      videoId: playlistTarget.videoId,
    });
    setPlaylistTarget(null);
    Alert.alert('Added', 'Saved to playlist');
  };

  const createPlaylistAndAdd = async () => {
    if (!playlistTarget) {
      return;
    }
    const pl = await createPlaylist(`Mix ${new Date().toLocaleDateString()}`);
    await addTrackToPlaylist(pl.id, {
      title: playlistTarget.title,
      type: 'AUDIO',
      thumbnailUrl: playlistTarget.thumbnailUrl,
      sourceUrl: playlistTarget.sourceUrl,
      videoId: playlistTarget.videoId,
    });
    setPlaylistTarget(null);
    Alert.alert('Added', 'Saved to new playlist');
  };

  const handlePasteLink = async () => {
    const text = await Clipboard.getString();
    const videoId = extractYouTubeVideoId(text);
    if (!videoId) {
      Alert.alert('Invalid link', 'Copy a YouTube watch, youtu.be, or shorts link first.');
      return;
    }
    const url = youTubeWatchUrl(videoId);
    setQuery(url);
    search(url);
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
      <TouchableOpacity
        style={[styles.pasteRow, {marginHorizontal: layout.hPad}]}
        onPress={handlePasteLink}>
        <Icon name="link-outline" size={16} color={COLORS.primary} />
        <Text style={[styles.pasteText, {fontSize: layout.font.sm}]}>Paste YouTube link</Text>
      </TouchableOpacity>

      <View style={[styles.toolRow, {marginHorizontal: layout.hPad}]}>
        <TouchableOpacity
          style={[styles.toolChip, batchMode && styles.toolChipActive]}
          onPress={() => {
            setBatchMode(v => !v);
            setSelectedBatch(new Set());
          }}>
          <Icon name="albums-outline" size={14} color={batchMode ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.toolChipText, batchMode && styles.toolChipTextActive]}>Batch</Text>
        </TouchableOpacity>
        {batchMode ? (
          <>
            <TouchableOpacity
              style={[styles.toolChip, batchPickerType === 'AUDIO' && styles.toolChipActive]}
              onPress={() => setBatchPickerType('AUDIO')}>
              <Text style={styles.toolChipText}>MP3</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toolChip, batchPickerType === 'VIDEO' && styles.toolChipActive]}
              onPress={() => setBatchPickerType('VIDEO')}>
              <Text style={styles.toolChipText}>MP4</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.queueBtn} onPress={queueBatchDownloads}>
              <Text style={styles.queueBtnText}>Queue ({selectedBatch.size})</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      {history.length > 0 && results.length === 0 && !loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips, {paddingHorizontal: layout.hPad}]}
          style={styles.chipsWrap}>
          {history.map(h => (
            <TouchableOpacity
              key={h}
              style={styles.chip}
              onPress={() => setQuery(h)}
              onLongPress={() => removeSearchHistoryItem(h).then(loadHistory)}>
              <Icon name="time-outline" size={14} color={COLORS.textMuted} />
              <Text style={styles.chipText}>{h}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {results.length === 0 && !loading ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chips, {paddingHorizontal: layout.hPad}]}
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
            }}
            onPlayAudio={() => openPicker(item, 'AUDIO', 'play')}
            onPlayVideo={() => openPicker(item, 'VIDEO', 'play')}
            onDownloadAudio={() => openPicker(item, 'AUDIO', 'download')}
            onDownloadVideo={() => openPicker(item, 'VIDEO', 'download')}
            onPlayNext={() => runQueue(item, 'AUDIO', 'next')}
            onAddToQueue={() => runQueue(item, 'AUDIO', 'end')}
            isFavorite={favoriteIds.has(`AUDIO:${item.videoId}`)}
            onToggleFavorite={() => handleToggleFavorite(item)}
            onAddToPlaylist={() => openPlaylistPicker(item)}
            batchSelect={batchMode}
            selected={selectedBatch.has(item.videoId)}
            onToggleSelect={() => toggleBatchSelect(item.videoId)}
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

      <PlaylistPickerSheet
        visible={playlistTarget != null}
        playlists={playlists}
        onClose={() => setPlaylistTarget(null)}
        onSelect={addSearchToPlaylist}
        onCreateNew={createPlaylistAndAdd}
      />
      <DownloadQueueBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  pasteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.xs,
    paddingVertical: 6,
  },
  pasteText: {color: COLORS.primary, fontWeight: '700'},
  toolRow: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm},
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
  },
  toolChipActive: {borderColor: COLORS.primary, backgroundColor: 'rgba(255,153,0,0.12)'},
  toolChipText: {color: COLORS.textMuted, fontWeight: '700', fontSize: 12},
  toolChipTextActive: {color: COLORS.primary},
  queueBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  queueBtnText: {color: '#111', fontWeight: '800', fontSize: 12},
  chipsWrap: {maxHeight: 48, marginBottom: SPACING.xs},
  chips: {gap: SPACING.sm},
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
