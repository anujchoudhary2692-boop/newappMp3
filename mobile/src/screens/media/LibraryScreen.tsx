import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect} from '@react-navigation/native';
import {MediaCard} from '../../components/MediaCard';
import {EmptyState} from '../../components/EmptyState';
import {MediaListSkeleton} from '../../components/Skeleton';
import {usePlayback} from '../../context/PlaybackContext';
import {api, MediaItem} from '../../api/client';
import {buildLibraryQueue} from '../../utils/playbackQueue';
import {goToMediaTab, openPlayerScreen} from '../../navigation/navigationRef';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE, enterpriseStyles} from '../../theme/enterprise';
import {connectionErrorHint} from '../../utils/serverConnection';
import {
  deleteLocalMedia,
  listLocalMedia,
  localRecordToMediaItem,
} from '../../utils/localMediaStore';
import {useLayoutMetrics} from '../../utils/layout';

interface Props {
  type: 'AUDIO' | 'VIDEO';
}

function mergeLibraryItems(serverItems: MediaItem[], localItems: MediaItem[]): MediaItem[] {
  const map = new Map<string, MediaItem>();
  for (const item of serverItems) {
    map.set(item.id, item);
  }
  for (const item of localItems) {
    const existing = [...map.values()].find(
      s => s.sourceUrl === item.sourceUrl && s.type === item.type,
    );
    if (existing) {
      map.set(existing.id, {
        ...existing,
        streamUrl: item.streamUrl,
        quality: item.quality,
      });
    } else {
      map.set(item.id, item);
    }
  }
  return [...map.values()].sort((a, b) =>
    (b.downloadedAt || '').localeCompare(a.downloadedAt || ''),
  );
}

export function LibraryScreen({type}: Props) {
  const layout = useLayoutMetrics(true);
  const {playQueue, media, queueLength, repeatQueue, toggleRepeatQueue, shuffleQueue, toggleShuffleQueue} = usePlayback();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const isAudio = type === 'AUDIO';
  const accent = isAudio ? COLORS.audio : COLORS.video;
  const onDeviceCount = useMemo(
    () => items.filter(item => item.streamUrl.startsWith('file://')).length,
    [items],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [serverResponse, localRecords] = await Promise.all([
        type === 'AUDIO' ? api.getAudioLibrary() : api.getVideoLibrary(),
        listLocalMedia(type),
      ]);
      const serverItems = serverResponse.success ? serverResponse.data || [] : [];
      const localItems = localRecords.map(localRecordToMediaItem);
      setItems(mergeLibraryItems(serverItems, localItems));
    } catch {
      const localRecords = await listLocalMedia(type);
      if (localRecords.length > 0) {
        setItems(localRecords.map(localRecordToMediaItem));
      } else {
        Alert.alert('Error', connectionErrorHint());
      }
    } finally {
      setLoading(false);
    }
  }, [type]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (item: MediaItem) => {
    Alert.alert('Delete', `Remove "${item.title}"?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (item.streamUrl.startsWith('file://')) {
              await deleteLocalMedia(item.id);
            } else {
              const response = await api.deleteMedia(item.id);
              if (!response.success) {
                Alert.alert('Delete failed', response.message || 'Try again');
                return;
              }
            }
            load();
          } catch {
            Alert.alert('Delete failed', 'Could not remove item');
          }
        },
      },
    ]);
  };

  const handlePlay = async (index: number) => {
    const queue = await buildLibraryQueue(items);
    playQueue(queue, index);
    const track = queue[index];
    openPlayerScreen(track.media, track.streamUrl);
  };

  return (
    <View style={enterpriseStyles.page}>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading && items.length > 0}
            onRefresh={load}
            tintColor={accent}
          />
        }
        ListHeaderComponent={
          loading && items.length === 0 ? (
            <MediaListSkeleton count={5} />
          ) : (
            <LinearGradient
              colors={isAudio ? ['rgba(255,153,0,0.12)', 'transparent'] : ['rgba(255,107,157,0.12)', 'transparent']}
              style={[styles.sectionHeader, {paddingHorizontal: layout.hPad}]}>
              <View style={styles.sectionTop}>
                <View style={styles.sectionTitles}>
                  <View style={styles.titleRow}>
                    <Icon name={isAudio ? 'musical-notes' : 'videocam'} size={20} color={accent} />
                    <Text style={[styles.sectionTitle, {color: accent, fontSize: layout.font.xl}]}>
                      {isAudio ? 'My Music' : 'My Videos'}
                    </Text>
                  </View>
                  <Text style={styles.sectionSub}>
                    {items.length} saved · {onDeviceCount} on device · plays offline
                  </Text>
                </View>
                {items.length > 1 ? (
                  <View style={styles.queueChips}>
                    <TouchableOpacity
                      style={[styles.repeatChip, shuffleQueue && {borderColor: accent, backgroundColor: `${accent}22`}]}
                      onPress={toggleShuffleQueue}>
                      <Icon name="shuffle" size={16} color={shuffleQueue ? accent : COLORS.textMuted} />
                      <Text style={[styles.repeatChipText, shuffleQueue && {color: accent}]}>Shuffle</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.repeatChip, repeatQueue && {borderColor: accent, backgroundColor: `${accent}22`}]}
                      onPress={toggleRepeatQueue}>
                      <Icon name="repeat" size={16} color={repeatQueue ? accent : COLORS.textMuted} />
                      <Text style={[styles.repeatChipText, repeatQueue && {color: accent}]}>
                        Repeat
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          )
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={isAudio ? 'musical-notes-outline' : 'videocam-outline'}
              title={isAudio ? 'No songs yet' : 'No videos yet'}
              subtitle={
                isAudio
                  ? 'Search and save MP3s — stored on your phone for offline playback'
                  : 'Search and save HD videos — watch anytime without internet'
              }
              accentColor={accent}
              actionLabel="Go to Search"
              onAction={() => goToMediaTab('SearchTab')}
            />
          ) : null
        }
        renderItem={({item, index}) => (
          <MediaCard
            title={item.title}
            subtitle={
              item.streamUrl.startsWith('file://')
                ? `${item.quality || 'On device'} · Offline`
                : item.quality
            }
            thumbnailUrl={item.thumbnailUrl}
            mode="library"
            type={item.type}
            active={queueLength > 0 && media?.libraryId === item.id}
            onPlay={() => handlePlay(index)}
            onDelete={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={
          items.length === 0
            ? [styles.emptyList, {paddingBottom: layout.contentBottomPadWithPlayer}]
            : [styles.list, {paddingBottom: layout.contentBottomPadWithPlayer}]
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.divider,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  queueChips: {flexDirection: 'row', gap: SPACING.sm, flexShrink: 0},
  sectionTitles: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  repeatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  repeatChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  list: {},
  emptyList: {flexGrow: 1},
});
