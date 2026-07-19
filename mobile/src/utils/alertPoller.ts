import {AppState, PermissionsAndroid, Platform} from 'react-native';
import {api} from '../api/client';
import {getUnreadAlerts, incrementUnreadAlerts, isFaceAlertsEnabled} from './faceAlerts';

let interval: ReturnType<typeof setInterval> | null = null;
let lastSeenAlertId: string | null = null;
let notificationsReady = false;

async function ensureNotificationPermission(): Promise<void> {
  if (notificationsReady) return;
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch {
      // ignore
    }
  }
  notificationsReady = true;
}

async function showBackgroundAlert(personName: string, confidence: number, location?: string) {
  await ensureNotificationPermission();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const notifee = require('@notifee/react-native').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {AndroidImportance} = require('@notifee/react-native');
    const channelId =
      Platform.OS === 'android'
        ? await notifee.createChannel({
            id: 'face-alerts',
            name: 'Face sighting alerts',
            importance: AndroidImportance.HIGH,
          })
        : undefined;
    await notifee.displayNotification({
      title: 'Person sighted',
      body: `${personName} (${Math.round(confidence)}%)${location ? ` · ${location}` : ''}`,
      android: channelId ? {channelId, pressAction: {id: 'default'}} : undefined,
      ios: {sound: 'default'},
    });
  } catch {
    // notifee not linked — silent on background
  }
}

async function pollAlerts() {
  if (!(await isFaceAlertsEnabled())) return;
  if (AppState.currentState === 'active') return;
  try {
    const res = await api.getRecentAlerts(5);
    if (!res.success || !res.data?.length) return;
    const latest = res.data[0];
    if (!latest.id || latest.id === lastSeenAlertId) return;
    lastSeenAlertId = latest.id;
    await incrementUnreadAlerts();
    await showBackgroundAlert(
      latest.personName || 'Unknown',
      latest.confidence,
      latest.locationLabel,
    );
  } catch {
    // ignore polling errors
  }
}

export function startAlertPoller() {
  if (interval) return;
  void getUnreadAlerts();
  void ensureNotificationPermission();
  interval = setInterval(() => {
    void pollAlerts();
  }, 45000);
}

export function stopAlertPoller() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
