import React, {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {api, PersonPhoto} from '../../api/client';
import {AppHeader} from '../../components/AppHeader';
import {COLORS, RADIUS, SPACING} from '../../config';
import {FaceStackParamList} from '../../navigation/types';
import {ScanMode, ScanProgress, scanPersonLibrary} from '../../utils/libraryScanner';
import {formatVideoTimestamp} from '../../utils/videoFrames';
import {useLayoutMetrics} from '../../utils/layout';
import {notifyPersonSighted} from '../../utils/faceAlerts';

type Props = NativeStackScreenProps<FaceStackParamList, 'PersonPhotos'>;

const GRID_GAP = 2;
const NUM_COLUMNS = 3;

function photoBadge(photo: PersonPhoto) {
  if (photo.groupPhoto) {
    return {icon: 'people' as const, label: 'Group', color: COLORS.warning};
  }
  if (photo.sourceType === 'VIDEO') {
    return {icon: 'videocam' as const, label: formatVideoTimestamp(photo.sourceTimestampMs) || 'Video', color: COLORS.video};
  }
  return null;
}

export function PersonPhotosScreen({route}: Props) {
  const {personId, personName} = route.params;
  const navigation = useNavigation<NativeStackScreenProps<FaceStackParamList>['navigation']>();
  const layout = useLayoutMetrics(true);
  const tileSize = (layout.contentW - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const [photos, setPhotos] = useState<PersonPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress>({
    scanned: 0,
    found: 0,
    photos: 0,
    videos: 0,
    groupMatches: 0,
  });
  const [viewerPhoto, setViewerPhoto] = useState<PersonPhoto | null>(null);
  const cancelScanRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getPersonPhotos(personId);
      if (response.success) {
        const list = response.data || [];
        setPhotos(list);
        knownIdsRef.current = new Set(
          list.map(p => p.devicePhotoId).filter(Boolean) as string[],
        );
      }
    } catch {
      Alert.alert('Error', 'Could not load photos');
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos]),
  );

  const startScan = (mode: ScanMode) => {
    const labels = {
      photos: 'photos only',
      videos: 'videos only',
      all: 'photos + videos (including group shots)',
    };
    Alert.alert(
      'Find this person',
      `Scan your library (${labels[mode]}) for ${personName}? Works in group photos and video frames.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Start', onPress: () => runScan(mode)},
      ],
    );
  };

  const runScan = async (mode: ScanMode) => {
    cancelScanRef.current = false;
    setScanning(true);
    setScanProgress({scanned: 0, found: 0, photos: 0, videos: 0, groupMatches: 0});

    try {
      const result = await scanPersonLibrary({
        personId,
        mode,
        shouldCancel: () => cancelScanRef.current,
        knownDeviceIds: knownIdsRef.current,
        onProgress: setScanProgress,
        onMatch: match => {
          void notifyPersonSighted(personName, match.confidence);
        },
      });

      await loadPhotos();
      Alert.alert(
        'Scan complete',
        `Checked ${result.scanned} items (${result.photos} photos, ${result.videos} videos)\n` +
          `Found ${result.found} new match${result.found === 1 ? '' : 'es'}` +
          (result.groupMatches > 0 ? ` · ${result.groupMatches} in group shots` : ''),
      );
    } catch (error) {
      Alert.alert(
        'Scan failed',
        error instanceof Error ? error.message : 'Could not read photo library',
      );
    } finally {
      setScanning(false);
      cancelScanRef.current = false;
    }
  };

  const stopScan = () => {
    cancelScanRef.current = true;
  };

  const handleDeletePhoto = (photo: PersonPhoto) => {
    Alert.alert('Remove photo', 'Remove this match from the album?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await api.deletePersonPhoto(photo.id);
            if (response.success) {
              setPhotos(current => current.filter(item => item.id !== photo.id));
            }
          } catch {
            Alert.alert('Error', 'Could not remove photo');
          }
        },
      },
    ]);
  };

  const groupCount = photos.filter(p => p.groupPhoto).length;
  const videoCount = photos.filter(p => p.sourceType === 'VIDEO').length;

  return (
    <View style={styles.container}>
      <AppHeader
        title={personName}
        subtitle={`${photos.length} matches${groupCount ? ` · ${groupCount} group` : ''}${videoCount ? ` · ${videoCount} video` : ''}`}
        showBack
        accentColor={COLORS.face}
      />

      <LinearGradient colors={['#0D2822', COLORS.background]} style={styles.hero}>
        <Icon name="scan-circle-outline" size={28} color={COLORS.face} />
        <Text style={styles.heroTitle}>Find in group photos & videos</Text>
        <Text style={styles.heroSub}>
          AI scans every face in each photo and multiple frames in videos — like Google Photos.
        </Text>

        {scanning ? (
          <View style={styles.scanProgressBox}>
            <ActivityIndicator color={COLORS.face} />
            <Text style={styles.scanProgressText}>
              {scanProgress.scanned} checked · {scanProgress.found} found
              {' · '}{scanProgress.photos} photos · {scanProgress.videos} videos
            </Text>
            <TouchableOpacity style={styles.stopBtn} onPress={stopScan}>
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scanActions}>
            <TouchableOpacity style={styles.scanPrimary} onPress={() => startScan('all')}>
              <Icon name="search" size={18} color={COLORS.background} />
              <Text style={styles.scanPrimaryText}>Scan all</Text>
            </TouchableOpacity>
            <View style={styles.scanRow}>
              <TouchableOpacity
                style={styles.scanSecondary}
                onPress={() => navigation.navigate('PersonTimeline', {personId, personName})}>
                <Icon name="time-outline" size={16} color={COLORS.face} />
                <Text style={styles.scanSecondaryText}>Trace</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanSecondary} onPress={() => startScan('photos')}>
                <Icon name="images-outline" size={16} color={COLORS.face} />
                <Text style={styles.scanSecondaryText}>Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanSecondary} onPress={() => startScan('videos')}>
                <Icon name="videocam-outline" size={16} color={COLORS.face} />
                <Text style={styles.scanSecondaryText}>Videos</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>

      {loading && photos.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.face} size="large" />
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={
            photos.length === 0
              ? [styles.emptyList, {paddingBottom: layout.contentBottomPadWithPlayer}]
              : [styles.grid, {paddingHorizontal: layout.hPad, paddingBottom: layout.contentBottomPadWithPlayer}]
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <Icon name="people-circle-outline" size={52} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>No matches yet</Text>
                <Text style={styles.emptySubtitle}>
                  Tap Scan all to search group photos and videos on your phone
                </Text>
              </View>
            ) : null
          }
          renderItem={({item}) => {
            const badge = photoBadge(item);
            return (
              <TouchableOpacity
                style={[styles.tile, {width: tileSize, height: tileSize}]}
                onPress={() => setViewerPhoto(item)}
                onLongPress={() => handleDeletePhoto(item)}
                activeOpacity={0.85}>
                <Image source={{uri: api.getImageUrl(item.imageUrl)}} style={styles.tileImage} />
                {item.confidence != null ? (
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>{Math.round(item.confidence)}%</Text>
                  </View>
                ) : null}
                {badge ? (
                  <View style={[styles.typeBadge, {backgroundColor: `${badge.color}DD`}]}>
                    <Icon name={badge.icon} size={10} color={COLORS.text} />
                    <Text style={styles.typeBadgeText}>{badge.label}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal visible={!!viewerPhoto} transparent animationType="fade">
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerPhoto(null)}>
          {viewerPhoto ? (
            <>
              <Image
                source={{uri: api.getImageUrl(viewerPhoto.imageUrl)}}
                style={styles.viewerImage}
                resizeMode="contain"
              />
              <View style={styles.viewerMeta}>
                {viewerPhoto.groupPhoto ? (
                  <Text style={styles.viewerMetaText}>
                    Group photo · {viewerPhoto.facesDetected ?? '?'} faces · matched face #{(viewerPhoto.matchedFaceIndex ?? 0) + 1}
                  </Text>
                ) : null}
                {viewerPhoto.sourceType === 'VIDEO' ? (
                  <Text style={styles.viewerMetaText}>
                    Video at {formatVideoTimestamp(viewerPhoto.sourceTimestampMs) || '0:00'}
                  </Text>
                ) : null}
                <Text style={styles.viewerMetaText}>
                  Confidence {Math.round(viewerPhoto.confidence)}%
                </Text>
              </View>
            </>
          ) : null}
          <TouchableOpacity
            style={[styles.viewerClose, {top: layout.insets.top + 12, right: layout.hPad}]}
            onPress={() => setViewerPhoto(null)}>
            <Icon name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  hero: {
    padding: SPACING.md,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  heroTitle: {color: COLORS.text, fontSize: 17, fontWeight: '800'},
  heroSub: {color: COLORS.textSecondary, fontSize: 13, lineHeight: 19},
  scanActions: {gap: SPACING.sm, marginTop: SPACING.xs},
  scanPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.face,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  scanPrimaryText: {color: COLORS.background, fontWeight: '800', fontSize: 15},
  scanRow: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm},
  scanSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.face,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
  },
  scanSecondaryText: {color: COLORS.face, fontWeight: '700', fontSize: 13},
  scanProgressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
  },
  scanProgressText: {flex: 1, color: COLORS.textSecondary, fontSize: 12},
  stopBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  stopBtnText: {color: COLORS.danger, fontWeight: '700', fontSize: 12},
  grid: {paddingTop: GRID_GAP},
  emptyList: {flexGrow: 1},
  tile: {
    margin: GRID_GAP / 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  tileImage: {width: '100%', height: '100%'},
  confidenceBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  confidenceText: {color: COLORS.text, fontSize: 10, fontWeight: '700'},
  typeBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {color: COLORS.text, fontSize: 9, fontWeight: '700'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    marginTop: 60,
  },
  emptyTitle: {color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: SPACING.md},
  emptySubtitle: {color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 20},
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {width: '100%', height: '72%'},
  viewerMeta: {
    position: 'absolute',
    bottom: 48,
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  viewerMetaText: {color: COLORS.text, fontSize: 13, fontWeight: '600'},
  viewerClose: {position: 'absolute', padding: 8},
});
