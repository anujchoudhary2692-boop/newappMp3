import React, {useCallback, useState} from 'react';
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
import {openPlayerScreen} from '../../navigation/navigationRef';
import {COLORS, GRADIENTS, RADIUS, SPACING} from '../../config';
import {connectionErrorHint} from '../../utils/serverConnection';
import {useLayoutMetrics} from '../../utils/layout';

interface Props {
  type: 'AUDIO' | 'VIDEO';
}

export function LibraryScreen({type}: Props) {
  const layout = useLayoutMetrics(true);
  const {playQueue, media, queueLength, repeatQueue, toggleRepeatQueue} = usePlayback();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const isAudio = type === 'AUDIO';
  const accent = isAudio ? COLORS.audio : COLORS.video;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response =
        type === 'AUDIO'
          ? await api.getAudioLibrary()
          : await api.getVideoLibrary();
      if (response.success) {
        setItems(response.data || []);
      }
    } catch {
      Alert.alert('Error', connectionErrorHint());
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
            const response = await api.deleteMedia(item.id);
            if (response.success) {
              load();
            } else {
              Alert.alert('Delete failed', response.message || 'Try again');
            }
          } catch {
            Alert.alert('Delete failed', 'Could not remove item');
          }
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={GRADIENTS.media} style={styles.container}>
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
              colors={isAudio ? ['rgba(124,92,255,0.18)', 'transparent'] : ['rgba(255,107,157,0.18)', 'transparent']}
              style={[styles.sectionHeader, {paddingHorizontal: layout.hPad}]}>
              <View style={styles.sectionTop}>
                <View style={styles.sectionTitles}>
                  <View style={styles.titleRow}>
                    <Icon name={isAudio ? 'musical-notes' : 'videocam'} size={20} color={accent} />
                    <Text style={[styles.sectionTitle, {color: accent}]}>
                      {isAudio ? 'My Music' : 'My Videos'}
                    </Text>
                  </View>
                  <Text style={styles.sectionSub}>
                    {items.length} saved · plays through automatically
                  </Text>
                </View>
                {items.length > 1 ? (
                  <TouchableOpacity
                    style={[styles.repeatChip, repeatQueue && {borderColor: accent, backgroundColor: `${accent}22`}]}
                    onPress={toggleRepeatQueue}>
                    <Icon name="repeat" size={16} color={repeatQueue ? accent : COLORS.textMuted} />
                    <Text style={[styles.repeatChipText, repeatQueue && {color: accent}]}>
                      Repeat
                    </Text>
                  </TouchableOpacity>
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
                  ? 'Search and save MP3s — they appear here for offline playback'
                  : 'Search and save HD videos — watch anytime without internet'
              }
              accentColor={accent}
            />
          ) : null
        }
        renderItem={({item, index}) => (
          <MediaCard
            title={item.title}
            subtitle={item.quality}
            thumbnailUrl={item.thumbnailUrl}
            mode="library"
            type={item.type}
            active={queueLength > 0 && media?.libraryId === item.id}
            onPlay={() => {
              const queue = buildLibraryQueue(items);
              playQueue(queue, index);
              const track = queue[index];
              openPlayerScreen(track.media, track.streamUrl);
            }}
            onDelete={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={
          items.length === 0
            ? [styles.emptyList, {paddingBottom: layout.contentBottomPadWithPlayer}]
            : [styles.list, {paddingBottom: layout.contentBottomPadWithPlayer}]
        }
      />
    </LinearGradient>
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
    borderBottomColor: COLORS.border,
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
