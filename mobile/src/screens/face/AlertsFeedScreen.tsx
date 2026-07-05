import React, {useCallback, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {api, PersonTimelineEntry} from '../../api/client';
import {AppHeader} from '../../components/AppHeader';
import {COLORS, SPACING} from '../../config';
import {FaceStackParamList} from '../../navigation/types';
import {useLayoutMetrics} from '../../utils/layout';
import {getApiBaseUrl} from '../../config';
import {clearUnreadAlerts} from '../../utils/faceAlerts';

type Nav = NativeStackNavigationProp<FaceStackParamList>;

export function AlertsFeedScreen() {
  const layout = useLayoutMetrics(true);
  const navigation = useNavigation<Nav>();
  const [alerts, setAlerts] = useState<PersonTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getRecentAlerts(50);
      if (res.success) {
        setAlerts(res.data || []);
      }
    } catch {
      Alert.alert('Error', 'Could not load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void clearUnreadAlerts();
    }, [load]),
  );

  const imageUrl = (path: string) =>
    path.startsWith('http') ? path : `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  return (
    <View style={styles.flex}>
      <AppHeader title="Recent sightings" subtitle="Last 24 hours" showBack accentColor={COLORS.face} />
      {loading ? (
        <ActivityIndicator color={COLORS.face} style={{marginTop: 32}} />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          contentContainerStyle={{padding: layout.hPad, paddingBottom: layout.contentBottomPad}}
          ListEmptyComponent={<Text style={styles.empty}>No recent face matches.</Text>}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (item.personId && item.personName) {
                  navigation.navigate('PersonTimeline', {
                    personId: item.personId,
                    personName: item.personName,
                  });
                }
              }}>
              <Image source={{uri: imageUrl(item.imageUrl)}} style={styles.thumb} />
              <View style={styles.meta}>
                <Text style={styles.name}>{item.personName || 'Unknown'}</Text>
                <Text style={styles.sub}>
                  {item.sourceType} · {Math.round(item.confidence)}%
                  {item.locationLabel ? ` · ${item.locationLabel}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: COLORS.background},
  empty: {textAlign: 'center', color: COLORS.textMuted, marginTop: 48},
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    marginBottom: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  thumb: {width: 64, height: 64, borderRadius: 8},
  meta: {flex: 1, justifyContent: 'center'},
  name: {fontWeight: '800', color: COLORS.text},
  sub: {fontSize: 12, color: COLORS.textMuted, marginTop: 4},
});
