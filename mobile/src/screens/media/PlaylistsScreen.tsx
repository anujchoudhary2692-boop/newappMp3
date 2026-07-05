import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
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
import {openPlayerScreen} from '../../navigation/navigationRef';
import {
  addTrackToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylist,
  listPlaylists,
  removeTrackFromPlaylist,
  type Playlist,
  type PlaylistTrack,
} from '../../utils/playlistStore';
import {buildLibraryQueue} from '../../utils/playbackQueue';
import {useLayoutMetrics} from '../../utils/layout';

export function PlaylistsScreen() {
  const layout = useLayoutMetrics(true);
  const playback = usePlayback();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setPlaylists(await listPlaylists());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPlaylist = async (id: string) => {
    const pl = await getPlaylist(id);
    setSelected(pl);
  };

  const handleCreate = async () => {
    try {
      await createPlaylist(nameInput);
      setNameInput('');
      setShowCreate(false);
      load();
    } catch (e) {
      Alert.alert('Could not create playlist', e instanceof Error ? e.message : 'Try again');
    }
  };

  const handleDeletePlaylist = (pl: Playlist) => {
    Alert.alert('Delete playlist?', `"${pl.name}" will be removed.`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePlaylist(pl.id);
          if (selected?.id === pl.id) {
            setSelected(null);
          }
          load();
        },
      },
    ]);
  };

  const handlePlayTrack = async (track: PlaylistTrack, tracks: PlaylistTrack[]) => {
    const mediaItems = tracks.map(t => ({
      id: t.localMediaId || t.id,
      title: t.title,
      sourceUrl: t.sourceUrl || '',
      type: t.type,
      fileName: '',
      streamUrl: t.streamUrl || '',
      thumbnailUrl: t.thumbnailUrl || '',
      quality: t.quality,
    }));
    const index = tracks.findIndex(t => t.id === track.id);
    const queue = await buildLibraryQueue(mediaItems);
    playback.playQueue(queue, index);
    openPlayerScreen(queue[index].media, queue[index].streamUrl);
  };

  const handlePlayAll = async (tracks: PlaylistTrack[]) => {
    if (tracks.length === 0) {
      return;
    }
    await handlePlayTrack(tracks[0], tracks);
  };

  if (selected) {
    return (
      <View style={enterpriseStyles.page}>
        <View style={[styles.detailHeader, {paddingHorizontal: layout.hPad}]}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.detailTitles}>
            <Text style={styles.detailTitle} numberOfLines={1}>{selected.name}</Text>
            <Text style={styles.detailSub}>{selected.items.length} tracks</Text>
          </View>
          <TouchableOpacity onPress={() => handlePlayAll(selected.items)} style={styles.playAllBtn}>
            <Icon name="play" size={18} color="#111" />
          </TouchableOpacity>
        </View>
        <FlatList
          data={selected.items}
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <EmptyState
              icon="list-outline"
              title="Empty playlist"
              subtitle="Add songs from Search or Downloads"
              accentColor={COLORS.primary}
            />
          }
          renderItem={({item, index}) => (
            <MediaCard
              title={item.title}
              subtitle={item.quality || item.type}
              thumbnailUrl={item.thumbnailUrl}
              mode="library"
              type={item.type}
              onPlay={() => handlePlayTrack(item, selected.items)}
              onDelete={async () => {
                await removeTrackFromPlaylist(selected.id, item.id);
                openPlaylist(selected.id);
              }}
            />
          )}
          contentContainerStyle={{paddingBottom: layout.contentBottomPadWithPlayer}}
        />
      </View>
    );
  }

  return (
    <View style={enterpriseStyles.page}>
      <View style={[styles.header, {paddingHorizontal: layout.hPad}]}>
        <Text style={styles.headerTitle}>Playlists</Text>
        <Text style={styles.headerSub}>Create collections and play them in order</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Icon name="add" size={20} color="#111" />
          <Text style={styles.createText}>New playlist</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={playlists}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <EmptyState
            icon="albums-outline"
            title="No playlists yet"
            subtitle="Tap New playlist to organize your music and videos"
            accentColor={COLORS.primary}
          />
        }
        renderItem={({item}) => (
          <TouchableOpacity
            style={[styles.playlistRow, {marginHorizontal: layout.hPad}]}
            onPress={() => openPlaylist(item.id)}
            onLongPress={() => handleDeletePlaylist(item)}>
            <View style={styles.playlistIcon}>
              <Icon name="musical-notes" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.playlistMeta}>
              <Text style={styles.playlistName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.playlistCount}>{item.items.length} tracks</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
        contentContainerStyle={{paddingBottom: layout.contentBottomPadWithPlayer}}
      />

      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New playlist</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Playlist name"
              placeholderTextColor={COLORS.textMuted}
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleCreate}>
                <Text style={styles.modalSaveText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {paddingTop: SPACING.sm, paddingBottom: SPACING.md},
  headerTitle: {color: COLORS.text, fontSize: 22, fontWeight: '800'},
  headerSub: {color: COLORS.textMuted, fontSize: 13, marginTop: 4, marginBottom: SPACING.md},
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  createText: {color: '#111', fontWeight: '800'},
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: ENTERPRISE.cardBg,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
  },
  playlistIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,153,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistMeta: {flex: 1},
  playlistName: {color: COLORS.text, fontWeight: '700', fontSize: 16},
  playlistCount: {color: COLORS.textMuted, fontSize: 12, marginTop: 2},
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.divider,
  },
  backBtn: {padding: 6},
  detailTitles: {flex: 1},
  detailTitle: {color: COLORS.text, fontSize: 18, fontWeight: '800'},
  detailSub: {color: COLORS.textMuted, fontSize: 12},
  playAllBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    backgroundColor: ENTERPRISE.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
  },
  modalTitle: {color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: SPACING.md},
  modalInput: {
    borderWidth: 1,
    borderColor: ENTERPRISE.searchBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  modalActions: {flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.lg},
  modalCancel: {color: COLORS.textMuted, fontWeight: '700'},
  modalSave: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  modalSaveText: {color: '#111', fontWeight: '800'},
});

export {addTrackToPlaylist};
