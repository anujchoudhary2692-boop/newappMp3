import React, {useCallback, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {RouteProp, useFocusEffect, useNavigation, useRoute} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AppHeader} from '../../components/AppHeader';
import {CaptureVideoPlayer} from '../../components/CaptureVideoPlayer';
import {ToastBanner} from '../../components/ToastBanner';
import {api, CaptureItem} from '../../api/client';
import {COLORS, GRADIENTS, RADIUS, SHADOW, SPACING} from '../../config';
import {CameraStackParamList} from '../../navigation/types';
import {formatDurationMs} from '../../utils/captureSave';
import {useLayoutMetrics} from '../../utils/layout';
import {GeoMapView} from '../../components/GeoMapView';

type Route = RouteProp<CameraStackParamList, 'CaptureDetail'>;
type Nav = NativeStackNavigationProp<CameraStackParamList>;

function openMaps(lat: number, lon: number, label?: string) {
  const encoded = encodeURIComponent(label || 'Capture');
  Linking.openURL(
    Platform.select({
      ios: `maps:0,0?q=${encoded}@${lat},${lon}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}(${encoded})`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    })!,
  );
}

export function CaptureDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const layout = useLayoutMetrics(true);
  const [item, setItem] = useState<CaptureItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getCapture(route.params.captureId);
      if (res.success) {
        setItem(res.data || null);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not load capture');
    } finally {
      setLoading(false);
    }
  }, [route.params.captureId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleShare = async () => {
    if (!item) return;
    const url = api.getStreamUrl(item.fileUrl);
    await Share.share({
      message: [item.type, item.locationLabel, url].filter(Boolean).join('\n'),
    }).catch(() => {});
  };

  const handleCopy = () => {
    if (!item?.latitude || !item?.longitude) return;
    Clipboard.setString(`${item.latitude}, ${item.longitude}`);
    showToast('Coordinates copied');
  };

  const handleDelete = () => {
    if (!item) return;
    Alert.alert('Delete?', 'This cannot be undone.', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await api.deleteCapture(item.id);
          navigation.goBack();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <LinearGradient colors={GRADIENTS.camera} style={styles.center}>
        <ActivityIndicator color={COLORS.camera} size="large" />
      </LinearGradient>
    );
  }

  if (!item) {
    return (
      <LinearGradient colors={GRADIENTS.camera} style={styles.center}>
        <Text style={[styles.missing, {fontSize: layout.font.md}]}>Capture not found</Text>
      </LinearGradient>
    );
  }

  const mediaUrl = api.getStreamUrl(item.fileUrl);
  const hasCoords = item.latitude != null && item.longitude != null;
  const mediaH = layout.mediaHeight;

  return (
    <LinearGradient colors={GRADIENTS.camera} style={styles.root}>
      <AppHeader
        title={item.type === 'PHOTO' ? 'Photo' : 'Video'}
        subtitle={item.locationLabel}
        showBack
        accentColor={COLORS.camera}
        rightIcon="share-outline"
        onRightPress={handleShare}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingHorizontal: layout.hPad, paddingBottom: layout.contentBottomPadWithPlayer},
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.mediaWrap, {borderRadius: RADIUS.lg}]}>
          {item.type === 'PHOTO' ? (
            <Image source={{uri: mediaUrl}} style={{width: '100%', height: mediaH}} resizeMode="contain" />
          ) : (
            <CaptureVideoPlayer uri={mediaUrl} fileName={item.fileName} height={mediaH} />
          )}
        </View>

        {hasCoords ? (
          <GeoMapView
            height={220}
            points={[{
              id: item.id,
              latitude: item.latitude!,
              longitude: item.longitude!,
              title: item.locationLabel,
              subtitle: item.type,
              color: COLORS.camera,
            }]}
          />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {hasCoords ? (
            <ActionPill icon="copy-outline" label="Copy GPS" onPress={handleCopy} layout={layout} />
          ) : null}
          <ActionPill icon="share-social-outline" label="Share" onPress={handleShare} layout={layout} />
          {hasCoords ? (
            <ActionPill
              icon="map-outline"
              label="Maps"
              onPress={() => openMaps(item.latitude!, item.longitude!, item.locationLabel)}
              layout={layout}
            />
          ) : null}
          <ActionPill icon="trash-outline" label="Delete" danger onPress={handleDelete} layout={layout} />
        </ScrollView>

        <View style={styles.infoCard}>
          <InfoRow icon="time-outline" label="When" value={
            item.capturedAt ? new Date(item.capturedAt).toLocaleString() : '—'
          } layout={layout} />
          {item.type === 'VIDEO' && item.durationMs ? (
            <InfoRow icon="film-outline" label="Duration" value={formatDurationMs(item.durationMs)} layout={layout} />
          ) : null}
          <InfoRow icon="location" label="Place" value={item.locationLabel || 'No GPS tag'} layout={layout} />
          {item.scanStatus ? (
            <InfoRow
              icon="scan-outline"
              label="Face scan"
              value={`${item.scanStatus}${item.matchCount != null ? ` · ${item.matchCount} match(es)` : ''}`}
              layout={layout}
            />
          ) : null}
          {item.gpsAccuracy != null ? (
            <InfoRow icon="navigate-outline" label="GPS accuracy" value={`±${Math.round(item.gpsAccuracy)}m`} layout={layout} />
          ) : null}
          {item.address ? (
            <Text style={[styles.address, {fontSize: layout.font.sm, marginLeft: 30}]}>{item.address}</Text>
          ) : null}
          {hasCoords ? (
            <Text style={[styles.coords, {fontSize: layout.font.xs, marginLeft: 30}]}>
              {item.latitude!.toFixed(6)}, {item.longitude!.toFixed(6)}
              {item.altitude != null ? ` · ${Math.round(item.altitude)}m` : ''}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <ToastBanner
        visible={!!toast}
        message={toast || ''}
        accentColor={COLORS.camera}
        bottomOffset={layout.tabBar + 16}
      />
    </LinearGradient>
  );
}

function ActionPill({
  icon,
  label,
  onPress,
  danger,
  layout,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  layout: ReturnType<typeof useLayoutMetrics>;
}) {
  const color = danger ? COLORS.danger : COLORS.camera;
  return (
    <TouchableOpacity
      style={[styles.pill, {borderColor: `${color}44`, backgroundColor: `${color}18`}]}
      onPress={onPress}>
      <Icon name={icon} size={16} color={color} />
      <Text style={[styles.pillText, {fontSize: layout.font.sm, color}]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({
  icon,
  label,
  value,
  layout,
}: {
  icon: string;
  label: string;
  value: string;
  layout: ReturnType<typeof useLayoutMetrics>;
}) {
  return (
    <View style={styles.infoRow}>
      <Icon name={icon} size={17} color={COLORS.camera} />
      <View style={styles.infoBody}>
        <Text style={[styles.infoLabel, {fontSize: layout.font.xs}]}>{label}</Text>
        <Text style={[styles.infoValue, {fontSize: layout.font.md}]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  missing: {color: COLORS.textSecondary, fontWeight: '600'},
  content: {gap: SPACING.md, paddingTop: SPACING.sm},
  mediaWrap: {overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...SHADOW.md},
  actions: {gap: SPACING.sm, paddingVertical: 4},
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  pillText: {fontWeight: '700'},
  infoCard: {
    backgroundColor: 'rgba(26,26,36,0.92)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    ...SHADOW.sm,
  },
  infoRow: {flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm},
  infoBody: {flex: 1, minWidth: 0},
  infoLabel: {color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4},
  infoValue: {color: COLORS.text, fontWeight: '600', marginTop: 2},
  address: {color: COLORS.textSecondary, lineHeight: 20},
  coords: {color: COLORS.textMuted, fontWeight: '600', fontVariant: ['tabular-nums']},
});
