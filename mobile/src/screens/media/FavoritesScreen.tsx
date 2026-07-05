import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import {EmptyState} from '../../components/EmptyState';
import {MediaCard} from '../../components/MediaCard';
import {usePlayback} from '../../context/PlaybackContext';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE, enterpriseStyles} from '../../theme/enterprise';
import {prepareAndStartPlayback} from '../../features/media/services/PlaybackOrchestrator';
import {
  listFavorites,
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
  const [playlistPicker, setPlaylistPicker] = useState<FavoriteItem | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback(async () => {
    setItems(await listFavorites());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = items.filter(i => filter === 'ALL' || i.type === filter);

  const handlePlay = (item: FavoriteItem) => {
    void prepareAndStartPlayback(
      {
        videoId: item.videoId,
        title: item.title,
        thumbnailUrl: item.thumbnailUrl,
        channel: item.channel,
        sourceUrl: item.sourceUrl,
      },
      item.type,
      playback,
    );
  };

  const handleRemove = (item: FavoriteItem) => {
    Alert.alert('Remove favorite?', item.title, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeFavorite(item.id);
          load();
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

  const handleCreateAndAdd = async () => {
    setShowCreateModal(true);
  };

  return (
    <View style={enterpriseStyles.page}>
      <View style={[styles.header, {paddingHorizontal: layout.hPad}]}>
        <Text style={styles.headerTitle}>Favorites</Text>
        <Text style={styles.headerSub}>{items.length} saved songs and videos</Text>
        <View style={styles.chipsRow}>
          {(['ALL', 'AUDIO', 'VIDEO'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'ALL' ? 'All' : f === 'AUDIO' ? 'Audio' : 'Video'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No favorites yet"
            subtitle="Tap the heart on any search result to save it here"
            accentColor={COLORS.danger}
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
              <Text style={styles.addPlText}>Add to playlist</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={{paddingBottom: layout.contentBottomPadWithPlayer}}
      />

      <Modal visible={playlistPicker != null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add to playlist</Text>
            <TouchableOpacity style={styles.newPlRow} onPress={handleCreateAndAdd}>
              <Icon name="add" size={20} color={COLORS.primary} />
              <Text style={styles.newPlText}>Create new playlist</Text>
            </TouchableOpacity>
            <FlatList
              data={playlists}
              keyExtractor={p => p.id}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.plRow} onPress={() => addToPlaylist(item.id)}>
                  <Text style={styles.plName}>{item.name}</Text>
                  <Text style={styles.plCount}>{item.items.length} tracks</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setPlaylistPicker(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.createCard}>
            <Text style={styles.modalTitle}>New playlist name</Text>
            <TouchableOpacity
              style={styles.createQuick}
              onPress={async () => {
                const pl = await createPlaylist(`Favorites ${new Date().toLocaleDateString()}`);
                setShowCreateModal(false);
                if (playlistPicker) {
                  await addTrackToPlaylist(pl.id, {
                    title: playlistPicker.title,
                    type: playlistPicker.type,
                    thumbnailUrl: playlistPicker.thumbnailUrl,
                    sourceUrl: playlistPicker.sourceUrl,
                    videoId: playlistPicker.videoId,
                  });
                  setPlaylistPicker(null);
                  Alert.alert('Added', 'Saved to new playlist');
                }
              }}>
              <Text style={styles.createQuickText}>Create & add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {paddingTop: SPACING.sm, paddingBottom: SPACING.sm},
  headerTitle: {color: COLORS.text, fontSize: 22, fontWeight: '800'},
  headerSub: {color: COLORS.textMuted, fontSize: 13, marginTop: 4, marginBottom: SPACING.sm},
  chipsRow: {flexDirection: 'row', gap: SPACING.sm},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
  },
  chipActive: {borderColor: COLORS.danger, backgroundColor: 'rgba(255,77,106,0.12)'},
  chipText: {color: COLORS.textMuted, fontWeight: '700', fontSize: 12},
  chipTextActive: {color: COLORS.danger},
  addPlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
  },
  addPlText: {color: COLORS.primary, fontWeight: '700', fontSize: 13},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'},
  modalSheet: {
    backgroundColor: ENTERPRISE.cardBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '60%',
  },
  modalTitle: {color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: SPACING.md},
  newPlRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: SPACING.md},
  newPlText: {color: COLORS.primary, fontWeight: '700'},
  plRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.divider,
  },
  plName: {color: COLORS.text, fontWeight: '700'},
  plCount: {color: COLORS.textMuted, fontSize: 12},
  cancelBtn: {alignItems: 'center', paddingVertical: SPACING.md},
  cancelText: {color: COLORS.textMuted, fontWeight: '700'},
  createCard: {
    margin: SPACING.lg,
    backgroundColor: ENTERPRISE.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  createQuick: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  createQuickText: {color: '#111', fontWeight: '800'},
});
