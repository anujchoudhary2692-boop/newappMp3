import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Linking, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {api, PersonTimelineEntry} from '../../api/client';
import {AppHeader} from '../../components/AppHeader';
import {COLORS, SPACING} from '../../config';
import {FaceStackParamList} from '../../navigation/types';
import {formatVideoTimestamp} from '../../utils/videoFrames';
import {useLayoutMetrics} from '../../utils/layout';
import {getApiBaseUrl} from '../../config';
import {clearUnreadAlerts, openTraceExport} from '../../utils/faceAlerts';

type Props = NativeStackScreenProps<FaceStackParamList, 'PersonTimeline'>;

function dayKey(iso?: string) {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, {weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'});
}

function sourceLabel(entry: PersonTimelineEntry) {
  switch (entry.sourceType) {
    case 'CAPTURE':
      return 'Camera photo';
    case 'CAPTURE_VIDEO':
      return `Camera video ${formatVideoTimestamp(entry.sourceTimestampMs)}`;
    case 'MEDIA_VIDEO':
      return `Streamed video ${formatVideoTimestamp(entry.sourceTimestampMs)}`;
    case 'VIDEO':
      return `Library video ${formatVideoTimestamp(entry.sourceTimestampMs)}`;
    default:
      return entry.sourceType || 'Photo';
  }
}

export function PersonTimelineScreen({route, navigation}: Props) {
  const {personId, personName} = route.params;
  const layout = useLayoutMetrics(true);
  const [entries, setEntries] = useState<PersonTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getPersonTimeline(personId);
      if (res.success) {
        setEntries(res.data || []);
      }
    } catch {
      Alert.alert('Error', 'Could not load trace timeline');
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useFocusEffect(
    useCallback(() => {
      void load();
      void clearUnreadAlerts();
    }, [load]),
  );

  const sections = useMemo(() => {
    const map = new Map<string, PersonTimelineEntry[]>();
    for (const entry of entries) {
      const key = dayKey(entry.matchedAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).map(([title, data]) => ({title, data}));
  }, [entries]);

  const openMaps = (lat?: number, lng?: number) => {
    if (lat == null || lng == null) return;
    void Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`);
  };

  const imageUrl = (path: string) =>
    path.startsWith('http') ? path : `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  return (
    <View style={styles.flex}>
      <AppHeader
        title={`${personName} trace`}
        subtitle="When & where this person appeared"
        showBack
        accentColor={COLORS.face}
      />
      <View style={{flexDirection: 'row', paddingHorizontal: layout.hPad, gap: 8, marginBottom: 8}}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => void openTraceExport(personId, 'csv')}>
          <Text style={styles.exportText}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={() => void openTraceExport(personId, 'json')}>
          <Text style={styles.exportText}>JSON</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportBtn} onPress={() => void openTraceExport(personId, 'geojson')}>
          <Text style={styles.exportText}>Map</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.face} style={{marginTop: 32}} />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={item => item.title}
          contentContainerStyle={{paddingBottom: layout.contentBottomPad, paddingHorizontal: layout.hPad}}
          ListEmptyComponent={<Text style={styles.empty}>No sightings yet. Scan library or use camera.</Text>}
          renderItem={({item: section}) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.data.map(entry => (
                <TouchableOpacity
                  key={entry.id}
                  style={styles.row}
                  onPress={() => openMaps(entry.latitude, entry.longitude)}>
                  <Image source={{uri: imageUrl(entry.imageUrl)}} style={styles.thumb} />
                  <View style={styles.meta}>
                    <Text style={styles.source}>{sourceLabel(entry)}</Text>
                    <Text style={styles.sub}>
                      {Math.round(entry.confidence)}% match
                      {entry.locationLabel ? ` · ${entry.locationLabel}` : ''}
                    </Text>
                    {entry.mediaTitle && (
                      <Text style={styles.sub} numberOfLines={1}>
                        {entry.mediaTitle}
                      </Text>
                    )}
                  </View>
                  {entry.latitude != null && (
                    <Icon name="location" size={18} color={COLORS.face} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
      )}
      <TouchableOpacity
        style={[styles.fab, {bottom: layout.contentBottomPad}]}
        onPress={() => navigation.navigate('PersonPhotos', {personId, personName})}>
        <Icon name="grid" size={22} color="#fff" />
        <Text style={styles.fabText}>Gallery</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: COLORS.background},
  empty: {textAlign: 'center', color: COLORS.textMuted, marginTop: 48, paddingHorizontal: SPACING.lg},
  section: {marginBottom: SPACING.lg},
  sectionTitle: {fontWeight: '800', fontSize: 14, color: COLORS.textMuted, marginBottom: SPACING.sm},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  thumb: {width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.surface2},
  meta: {flex: 1},
  source: {fontWeight: '700', color: COLORS.text},
  sub: {fontSize: 12, color: COLORS.textMuted, marginTop: 2},
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.face,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
  },
  fabText: {color: '#fff', fontWeight: '700'},
  exportBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.surface2,
    alignItems: 'center',
  },
  exportText: {color: COLORS.face, fontWeight: '700', fontSize: 12},
});
