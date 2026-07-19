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
import {useFocusEffect} from '@react-navigation/native';
import {EmptyState} from '../../components/EmptyState';
import {MediaCard} from '../../components/MediaCard';
import {FilterChips} from '../../components/media/FilterChips';
import {MediaListHeader} from '../../components/media/MediaListHeader';
import {PlaylistPickerSheet} from '../../components/media/PlaylistPickerSheet';
import {usePlayback} from '../../context/PlaybackContext';
import {COLORS, SPACING} from '../../config';
import {enterpriseStyles} from '../../theme/enterprise';
import {goToMediaTab, openPlayerScreen} from '../../navigation/navigationRef';
import {
  prepareAndStartPlayback,
  prepareQueueTrack,
} from '../../features/media/services/PlaybackOrchestrator';
import {
  listFavorites,
  pullCloudFavorites,
  removeFavorite,
  type FavoriteItem,
} from '../../utils/favoritesStore';
import {
  addTrackToPlaylist,
  createPlaylist,
  listPlaylists,
  type Playlist,
} from '../../utils/playlistStore';
import {useLayoutMetrics} from '../../utils/layout';

export function FavoritesScreen() {
  const layout = useLayoutMetrics(true);
  const playback = usePlayback();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'AUDIO' | 'VIDEO'>('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const [playlistPicker, setPlaylistPicker] = useState<FavoriteItem | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [queueing, setQueueing] = useState(false);

  const load = useCallback(async () => {
    try {
      await pullCloudFavorites();
    } catch {
      // keep local cache
    }
    setItems(await listFavorites());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = items.filter(i => filter === 'ALL' || i.type === filter);
  const audioCount = items.filter(i => i.type === 'AUDIO').length;
  const videoCount = items.filter(i => i.type === 'VIDEO').length;

  const toSearchItem = (item: FavoriteItem) => ({
    videoId: item.videoId,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    channel: item.channel,
    sourceUrl: item.sourceUrl,
  });

  const handlePlay = (item: FavoriteItem) => {
    void prepareAndStartPlayback(toSearchItem(item), item.type, playback);
  };

  const handlePlayAll = async (startIdx = 0) => {
    if (filtered.length === 0 || queueing) return;
    setQueueing(true);
    try {
      const start = Math.min(Math.max(0, startIdx), filtered.length - 1);
      const first = filtered[start];
      const firstTrack = await prepareQueueTrack(toSearchItem(first), first.type);
      playback.playQueue([firstTrack], 0);
      openPlayerScreen(firstTrack.media, firstTrack.streamUrl);

      const rest = [...filtered.slice(start + 1), ...filtered.slice(0, start)];
      for (const item of rest) {
        try {
          const track = await prepareQueueTrack(toSearchItem(item), item.type);
          playback.enqueueTrack(track);
        } catch {
          // skip failed tracks
        }
      }
    } catch (e) {
      Alert.alert('Play failed', e instanceof Error ? e.message : 'Could not start favorites');
    } finally {
      setQueueing(false);
    }
  };

  const handleRemove = (item: FavoriteItem) => {
    Alert.alert('Remove favorite?', item.title, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeFavorite(item.id);
          void load();
        },
      },
    ]);
  };

  const openPlaylistPicker = async (item: FavoriteItem) => {
    setPlaylists(await listPlaylists());
    setPlaylistPicker(item);
  };

  const addToPlaylist = async (playlistId: string) => {
    if (!playlistPicker) {
      return;
    }
    await addTrackToPlaylist(playlistId, {
      title: playlistPicker.title,
      type: playlistPicker.type,
      thumbnailUrl: playlistPicker.thumbnailUrl,
      sourceUrl: playlistPicker.sourceUrl,
      videoId: playlistPicker.videoId,
    });
    setPlaylistPicker(null);
    Alert.alert('Added', 'Saved to playlist');
  };

  const createPlaylistAndAdd = async () => {
    if (!playlistPicker) {
      return;
    }
    const pl = await createPlaylist(`Favorites ${new Date().toLocaleDateString()}`);
    await addTrackToPlaylist(pl.id, {
      title: playlistPicker.title,
      type: playlistPicker.type,
      thumbnailUrl: playlistPicker.thumbnailUrl,
      sourceUrl: playlistPicker.sourceUrl,
      videoId: playlistPicker.videoId,
    });
    setPlaylistPicker(null);
    Alert.alert('Added', 'Saved to new playlist');
  };

  return (
    <View style={enterpriseStyles.page}>
      <MediaListHeader
        title="Favorites"
        subtitle={`${items.length} saved songs and videos`}
        action={
          filtered.length > 0 ? (
            <TouchableOpacity
              style={[styles.playAllBtn, queueing && {opacity: 0.6}]}
              disabled={queueing}
              onPress={() => void handlePlayAll()}>
              <Icon name={queueing ? 'hourglass-outline' : 'play'} size={18} color="#111" />
            </TouchableOpacity>
          ) : null
        }>
        <FilterChips
          options={[
            {id: 'ALL', label: 'All', count: items.length},
            {id: 'AUDIO', label: 'Audio', count: audioCount},
            {id: 'VIDEO', label: 'Video', count: videoCount},
          ]}
          value={filter}
          onChange={setFilter}
          accentColor={COLORS.danger}
        />
      </MediaListHeader>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.danger} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No favorites yet"
            subtitle="Tap the heart on any search result to save it here"
            accentColor={COLORS.danger}
            actionLabel="Go to Search"
            onAction={() => goToMediaTab('SearchTab')}
          />
        }
        renderItem={({item}) => (
          <View>
            <MediaCard
              title={item.title}
              subtitle={`${item.channel} · ${item.type === 'AUDIO' ? 'MP3' : 'MP4'}`}
              thumbnailUrl={item.thumbnailUrl}
              mode="library"
              type={item.type}
              onPlay={() => handlePlay(item)}
              onDelete={() => handleRemove(item)}
            />
            <TouchableOpacity
              style={[styles.addPlBtn, {marginHorizontal: layout.hPad}]}
              onPress={() => openPlaylistPicker(item)}>
              <Icon name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={[styles.addPlText, {fontSize: layout.font.sm}]}>Add to playlist</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{paddingBottom: layout.contentBottomPadWithPlayer}}
      />

      <PlaylistPickerSheet
        visible={playlistPicker != null}
        playlists={playlists}
        onClose={() => setPlaylistPicker(null)}
        onSelect={addToPlaylist}
        onCreateNew={createPlaylistAndAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  playAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
  },
  addPlText: {color: COLORS.primary, fontWeight: '700'},
});
