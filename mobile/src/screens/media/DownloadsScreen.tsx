import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import {MediaCard} from '../../components/MediaCard';
import {EmptyState} from '../../components/EmptyState';
import {usePlayback} from '../../context/PlaybackContext';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE, enterpriseStyles} from '../../theme/enterprise';
import {openPlayerScreen} from '../../navigation/navigationRef';
import {buildLibraryQueue} from '../../utils/playbackQueue';
import {
  deleteLocalMedia,
  formatBytes,
  getLocalStorageStats,
  listLocalMedia,
  localRecordToMediaItem,
} from '../../utils/localMediaStore';
import {shareLocalMediaFile} from '../../utils/shareMediaFile';
import {importMediaFromFiles} from '../../utils/importMediaFile';
import type {MediaItem} from '../../features/media/domain/types';
import {useLayoutMetrics} from '../../utils/layout';

type Filter = 'ALL' | 'AUDIO' | 'VIDEO';
type Sort = 'newest' | 'oldest' | 'name' | 'size';

export function DownloadsScreen() {
  const layout = useLayoutMetrics(true);
  const {playQueue, media, queueLength} = usePlayback();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('newest');
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState({fileCount: 0, totalBytes: 0, audioCount: 0, videoCount: 0});
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, storage] = await Promise.all([listLocalMedia(), getLocalStorageStats()]);
      setItems(records.map(localRecordToMediaItem));
      setStats(storage);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'AUDIO') {
      list = list.filter(i => i.type === 'AUDIO');
    } else if (filter === 'VIDEO') {
      list = list.filter(i => i.type === 'VIDEO');
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(i => i.title.toLowerCase().includes(q));
    }
    list = [...list];
    switch (sort) {
      case 'oldest':
        list.sort((a, b) => (a.downloadedAt || '').localeCompare(b.downloadedAt || ''));
        break;
      case 'name':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'size':
        list.sort((a, b) => (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0));
        break;
      default:
        list.sort((a, b) => (b.downloadedAt || '').localeCompare(a.downloadedAt || ''));
    }
    return list;
  }, [items, filter, sort, query]);

  const handlePlay = async (index: number) => {
    const queue = await buildLibraryQueue(filtered);
    playQueue(queue, index);
    openPlayerScreen(queue[index].media, queue[index].streamUrl);
  };

  const handleDelete = (item: MediaItem) => {
    Alert.alert('Delete file?', `Remove "${item.title}" from your phone?`, [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteLocalMedia(item.id);
          load();
        },
      },
    ]);
  };

  const handleShare = async (item: MediaItem) => {
    try {
      const path = item.streamUrl.replace(/^file:\/\//, '');
      await shareLocalMediaFile(path.startsWith('/') ? path : item.streamUrl, item.title);
    } catch {
      Alert.alert('Share failed', 'Could not share this file.');
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const imported = await importMediaFromFiles();
      if (imported.length > 0) {
        Alert.alert('Imported', `${imported.length} file(s) added from Files`);
        load();
      }
    } catch {
      Alert.alert('Import failed', 'Could not import the selected files.');
    } finally {
      setImporting(false);
    }
  };

  const filters: {id: Filter; label: string; count: number}[] = [
    {id: 'ALL', label: 'All', count: stats.fileCount},
    {id: 'AUDIO', label: 'Audio', count: stats.audioCount},
    {id: 'VIDEO', label: 'Video', count: stats.videoCount},
  ];

  return (
    <View style={enterpriseStyles.page}>
      <View style={[styles.header, {paddingHorizontal: layout.hPad}]}>
        <View style={styles.headerTopRow}>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>My Downloads</Text>
            <Text style={styles.headerSub}>
              {stats.fileCount} files · {formatBytes(stats.totalBytes)} · offline on this device
            </Text>
          </View>
          <TouchableOpacity style={styles.importBtn} onPress={handleImport} disabled={importing}>
            <Icon name="folder-open-outline" size={18} color={COLORS.primary} />
            <Text style={styles.importBtnText}>{importing ? '…' : 'Import'}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your files..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.chipsRow}>
          {filters.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, filter === f.id && styles.chipActive]}
              onPress={() => setFilter(f.id)}>
              <Text style={[styles.chipText, filter === f.id && styles.chipTextActive]}>
                {f.label} ({f.count})
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.sortRow}>
          {(['newest', 'oldest', 'name', 'size'] as Sort[]).map(s => (
            <TouchableOpacity key={s} style={[styles.sortChip, sort === s && styles.sortChipActive]} onPress={() => setSort(s)}>
              <Text style={[styles.sortText, sort === s && styles.sortTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="folder-open-outline"
              title="No downloads yet"
              subtitle="Search any song or video, pick quality, save to your phone, or import from Files"
              accentColor={COLORS.primary}
            />
          ) : null
        }
        renderItem={({item, index}) => (
          <View>
            <MediaCard
              title={item.title}
              subtitle={`${item.quality || (item.type === 'AUDIO' ? 'MP3/M4A' : 'MP4')} · ${formatBytes(item.fileSizeBytes || 0)} · Offline`}
              thumbnailUrl={item.thumbnailUrl}
              mode="library"
              type={item.type}
              active={queueLength > 0 && media?.libraryId === item.id}
              onPlay={() => handlePlay(index)}
              onDelete={() => handleDelete(item)}
            />
            <View style={[styles.fileActions, {marginHorizontal: layout.hPad}]}>
              <TouchableOpacity style={styles.fileActionBtn} onPress={() => handleShare(item)}>
                <Icon name="share-outline" size={16} color={COLORS.primary} />
                <Text style={styles.fileActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={{paddingBottom: layout.contentBottomPadWithPlayer}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.divider,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  headerTitles: {flex: 1},
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255,153,0,0.1)',
  },
  importBtnText: {color: COLORS.primary, fontWeight: '800', fontSize: 12},
  headerTitle: {color: COLORS.text, fontSize: 22, fontWeight: '800'},
  headerSub: {color: COLORS.textMuted, fontSize: 13, marginTop: 4, marginBottom: SPACING.sm},
  searchInput: {
    backgroundColor: ENTERPRISE.searchBg,
    borderWidth: 1,
    borderColor: ENTERPRISE.searchBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  chipsRow: {flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
    backgroundColor: ENTERPRISE.searchBg,
  },
  chipActive: {borderColor: COLORS.primary, backgroundColor: 'rgba(255,153,0,0.12)'},
  chipText: {color: COLORS.textMuted, fontWeight: '700', fontSize: 12},
  chipTextActive: {color: COLORS.primary},
  sortRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  sortChipActive: {backgroundColor: 'rgba(255,153,0,0.15)'},
  sortText: {color: COLORS.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'capitalize'},
  sortTextActive: {color: COLORS.primary},
  fileActions: {
    flexDirection: 'row',
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    paddingLeft: SPACING.md,
  },
  fileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  fileActionText: {color: COLORS.primary, fontWeight: '700', fontSize: 13},
});
