import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getApiBaseUrl} from '../config';
import {getAuthToken} from './authStorage';

const DEVICE_ID_KEY = 'mediaface:deviceId';

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = `device-${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function registerPushToken(fcmToken?: string): Promise<void> {
  const token = fcmToken || (await getDeviceId());
  const deviceId = await getDeviceId();
  const authToken = await getAuthToken();
  const base = getApiBaseUrl().replace(/\/$/, '');
  await fetch(`${base}/api/push/register`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(authToken ? {Authorization: `Bearer ${authToken}`} : {}),
    },
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      deviceId,
    }),
  });
}

export async function initPushNotifications(): Promise<void> {
  try {
    await registerPushToken();
  } catch {
    // optional — FCM may not be configured
  }
}
