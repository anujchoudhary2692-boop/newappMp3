import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AppHeader} from '../../components/AppHeader';
import {EmptyState} from '../../components/EmptyState';
import {api, CaptureItem} from '../../api/client';
import {COLORS, GRADIENTS, RADIUS, SHADOW, SPACING} from '../../config';
import {CameraStackParamList} from '../../navigation/types';
import {formatDurationMs} from '../../utils/captureSave';
import {useLayoutMetrics} from '../../utils/layout';

type Nav = NativeStackNavigationProp<CameraStackParamList>;
type FilterKey = 'all' | 'photo' | 'video' | 'geo';

const FILTERS: {key: FilterKey; label: string; icon: string}[] = [
  {key: 'all', label: 'All', icon: 'apps'},
  {key: 'photo', label: 'Photos', icon: 'camera'},
  {key: 'video', label: 'Videos', icon: 'videocam'},
  {key: 'geo', label: 'Geo', icon: 'location'},
];

function formatWhen(iso?: string): string {
  if (!iso) {
    return '';
  }
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CapturesGalleryScreen() {
  const navigation = useNavigation<Nav>();
  const layout = useLayoutMetrics(true);
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCaptures();
      if (res.success) {
        setItems(res.data || []);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not load captures');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => items.filter(item => {
    if (filter === 'photo') return item.type === 'PHOTO';
    if (filter === 'video') return item.type === 'VIDEO';
    if (filter === 'geo') return item.latitude != null;
    return true;
  }), [items, filter]);

  const stats = useMemo(() => ({
    photos: items.filter(i => i.type === 'PHOTO').length,
    videos: items.filter(i => i.type === 'VIDEO').length,
    geo: items.filter(i => i.latitude != null).length,
  }), [items]);

  const tileW = layout.gridItemWidth;
  const tileH = tileW * 1.15;

  const handleDelete = (item: CaptureItem) => {
    Alert.alert('Delete capture?', 'Remove from library?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteCapture(item.id);
            load();
          } catch (error) {
            Alert.alert('Delete failed', error instanceof Error ? error.message : 'Try again');
          }
        },
      },
    ]);
  };

  const renderGridItem = ({item}: {item: CaptureItem}) => {
    const thumb = item.thumbnailUrl ? api.getImageUrl(item.thumbnailUrl) : undefined;
    return (
      <TouchableOpacity
        style={[styles.gridTile, {width: tileW, height: tileH, marginBottom: layout.gap}]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('CaptureDetail', {captureId: item.id})}
        onLongPress={() => handleDelete(item)}>
        {thumb ? (
          <Image source={{uri: thumb}} style={styles.fill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#3A2818', '#1A1208']} style={styles.fill}>
            <Icon name="videocam" size={layout.isCompact ? 22 : 28} color={COLORS.camera} />
          </LinearGradient>
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.82)']} style={styles.gridOverlay}>
          <View style={styles.gridTop}>
            <View style={styles.badge}>
              <Icon name={item.type === 'PHOTO' ? 'camera' : 'videocam'} size={10} color="#fff" />
            </View>
            {item.type === 'VIDEO' && item.durationMs ? (
              <Text style={[styles.duration, {fontSize: layout.font.xs}]}>
                {formatDurationMs(item.durationMs)}
              </Text>
            ) : null}
          </View>
          {item.locationLabel ? (
            <Text style={[styles.gridLoc, {fontSize: layout.font.xs}]} numberOfLines={1}>
              {item.locationLabel}
            </Text>
          ) : null}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({item}: {item: CaptureItem}) => {
    const thumb = item.thumbnailUrl ? api.getImageUrl(item.thumbnailUrl) : undefined;
    const thumbSize = layout.thumbSize;
    return (
      <TouchableOpacity
        style={[styles.listCard, {padding: layout.gap}]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('CaptureDetail', {captureId: item.id})}
        onLongPress={() => handleDelete(item)}>
        <View style={[styles.listThumb, {width: thumbSize, height: thumbSize}]}>
          {thumb ? (
            <Image source={{uri: thumb}} style={styles.fill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#3A2818', '#1A1208']} style={styles.fill}>
              <Icon name="videocam" size={22} color={COLORS.camera} />
            </LinearGradient>
          )}
        </View>
        <View style={styles.listMeta}>
          <Text style={[styles.listWhen, {fontSize: layout.font.md}]}>{formatWhen(item.capturedAt)}</Text>
          <Text style={[styles.listLoc, {fontSize: layout.font.sm}]} numberOfLines={2}>
            {item.locationLabel || 'No location'}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.statsRow}>
        {[
          {n: stats.photos, l: 'Photos', c: COLORS.camera},
          {n: stats.videos, l: 'Videos', c: '#FF6B9D'},
          {n: stats.geo, l: 'Geo', c: COLORS.accent},
        ].map(s => (
          <LinearGradient
            key={s.l}
            colors={[`${s.c}22`, 'rgba(26,26,36,0.95)']}
            style={styles.statCard}>
            <Text style={[styles.statNum, {fontSize: layout.font.xl, color: s.c}]}>{s.n}</Text>
            <Text style={[styles.statLabel, {fontSize: layout.font.xs}]}>{s.l}</Text>
          </LinearGradient>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}>
            <Icon name={f.icon} size={14} color={filter === f.key ? '#fff' : COLORS.textSecondary} />
            <Text style={[styles.filterText, {fontSize: layout.font.sm}, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.viewBtn} onPress={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}>
          <Icon name={viewMode === 'grid' ? 'list' : 'grid'} size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <LinearGradient colors={GRADIENTS.camera} style={styles.root}>
      <AppHeader
        title="Geo Gallery"
        subtitle={`${filtered.length} capture${filtered.length === 1 ? '' : 's'}`}
        showBack
        accentColor={COLORS.camera}
        rightIcon="camera-outline"
        onRightPress={() => navigation.navigate('CameraHome')}
        showSettings
      />

      <FlatList
        key={`${viewMode}-${layout.gridColumns}-${layout.width}`}
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={viewMode === 'grid' ? layout.gridColumns : 1}
        columnWrapperStyle={
          viewMode === 'grid'
            ? [styles.gridRow, {gap: layout.gap, marginBottom: 0}]
            : undefined
        }
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        contentContainerStyle={[
          styles.list,
          {paddingHorizontal: layout.hPad, paddingBottom: layout.tabBar + SPACING.lg},
        ]}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.camera} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <EmptyState
                icon="camera-outline"
                title={filter === 'all' ? 'No captures yet' : 'Nothing here'}
                subtitle="Open the camera and take your first geo-tagged shot."
                accentColor={COLORS.camera}
              />
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('CameraHome')}>
                <Text style={[styles.emptyBtnText, {fontSize: layout.font.md}]}>Open camera</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  list: {flexGrow: 1},
  header: {gap: SPACING.md, marginBottom: SPACING.md, paddingTop: SPACING.xs},
  statsRow: {flexDirection: 'row', gap: SPACING.sm},
  statCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...SHADOW.sm,
  },
  statNum: {fontWeight: '800'},
  statLabel: {color: COLORS.textMuted, fontWeight: '700', marginTop: 2},
  filters: {gap: SPACING.sm, alignItems: 'center'},
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterActive: {backgroundColor: COLORS.camera, borderColor: COLORS.camera},
  filterText: {color: COLORS.textSecondary, fontWeight: '700'},
  filterTextActive: {color: '#fff'},
  viewBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gridRow: {justifyContent: 'flex-start'},
  gridTile: {borderRadius: RADIUS.md, overflow: 'hidden', backgroundColor: '#111', ...SHADOW.sm},
  fill: {width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'},
  gridOverlay: {position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, gap: 4},
  gridTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  badge: {backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: 4},
  duration: {color: '#fff', fontWeight: '700'},
  gridLoc: {color: 'rgba(255,255,255,0.92)', fontWeight: '600'},
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: 'rgba(26,26,36,0.92)',
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...SHADOW.sm,
  },
  listThumb: {borderRadius: RADIUS.md, overflow: 'hidden'},
  listMeta: {flex: 1, gap: 4, minWidth: 0},
  listWhen: {color: COLORS.text, fontWeight: '700'},
  listLoc: {color: COLORS.textSecondary, fontWeight: '600'},
  empty: {flex: 1, justifyContent: 'center', paddingBottom: SPACING.xl},
  emptyBtn: {
    alignSelf: 'center',
    marginTop: SPACING.md,
    backgroundColor: COLORS.camera,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  emptyBtnText: {color: '#fff', fontWeight: '800'},
});
