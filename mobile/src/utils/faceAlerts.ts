import {Alert, Linking, Platform, Vibration} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getApiBaseUrl} from '../config';

const ALERTS_ENABLED_KEY = 'mediaface:faceAlertsEnabled';
const UNREAD_ALERTS_KEY = 'mediaface:unreadAlerts';

export async function isFaceAlertsEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ALERTS_ENABLED_KEY);
  return v !== 'false';
}

export async function setFaceAlertsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ALERTS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function incrementUnreadAlerts(): Promise<number> {
  const raw = await AsyncStorage.getItem(UNREAD_ALERTS_KEY);
  const next = (raw ? parseInt(raw, 10) : 0) + 1;
  await AsyncStorage.setItem(UNREAD_ALERTS_KEY, String(next));
  return next;
}

export async function clearUnreadAlerts(): Promise<void> {
  await AsyncStorage.removeItem(UNREAD_ALERTS_KEY);
}

export async function getUnreadAlerts(): Promise<number> {
  const raw = await AsyncStorage.getItem(UNREAD_ALERTS_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export async function notifyPersonSighted(
  personName: string,
  confidence: number,
  locationLabel?: string,
): Promise<void> {
  const enabled = await isFaceAlertsEnabled();
  if (!enabled) {
    return;
  }
  if (Platform.OS === 'android') {
    Vibration.vibrate(120);
  }
  await incrementUnreadAlerts();
  const where = locationLabel ? ` at ${locationLabel}` : '';
  Alert.alert(
    'Person sighted',
    `${personName} detected (${Math.round(confidence)}% confidence)${where}`,
    [{text: 'OK'}],
  );
}

export function traceExportUrl(personId: string, format: 'csv' | 'json' | 'geojson' | 'pdf'): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  return `${base}/api/faces/person/${personId}/timeline/export?format=${format}&limit=500`;
}

export async function openTraceExport(personId: string, format: 'csv' | 'json' | 'geojson' | 'pdf'): Promise<void> {
  const url = traceExportUrl(personId, format);
  await Linking.openURL(url);
}
