import {AppState, Platform} from 'react-native';
import {api} from '../api/client';
import {getUnreadAlerts, incrementUnreadAlerts, isFaceAlertsEnabled} from './faceAlerts';

let interval: ReturnType<typeof setInterval> | null = null;
let lastSeenAlertId: string | null = null;

async function showBackgroundAlert(personName: string, confidence: number, location?: string) {
  if (Platform.OS === 'android') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const notifee = require('@notifee/react-native').default;
      const {AndroidImportance} = require('@notifee/react-native');
      const channelId = await notifee.createChannel({
        id: 'face-alerts',
        name: 'Face sighting alerts',
        importance: AndroidImportance.HIGH,
      });
      await notifee.displayNotification({
        title: 'Person sighted',
        body: `${personName} (${Math.round(confidence)}%)${location ? ` · ${location}` : ''}`,
        android: {channelId, pressAction: {id: 'default'}},
      });
      return;
    } catch {
      // notifee not linked
    }
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
