const ALERTS_ENABLED_KEY = 'mediaface:faceAlertsEnabled';

export function isFaceAlertsEnabled(): boolean {
  return localStorage.getItem(ALERTS_ENABLED_KEY) !== 'false';
}

export function setFaceAlertsEnabled(enabled: boolean): void {
  localStorage.setItem(ALERTS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function notifyPersonSighted(
  personName: string,
  confidence: number,
  locationLabel?: string,
): Promise<void> {
  if (!isFaceAlertsEnabled()) {
    return;
  }
  const where = locationLabel ? ` · ${locationLabel}` : '';
  const body = `${Math.round(confidence)}% confidence${where}`;
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(`Person sighted: ${personName}`, {body});
    return;
  }
  // Fallback when permission not granted
  console.info(`[Face alert] ${personName}: ${body}`);
}

export function traceExportUrl(personId: string, format: 'csv' | 'json' | 'geojson' | 'pdf'): string {
  return `/api/faces/person/${personId}/timeline/export?format=${format}&limit=500`;
}

export function downloadTraceExport(personId: string, format: 'csv' | 'json' | 'geojson' | 'pdf'): void {
  const a = document.createElement('a');
  a.href = traceExportUrl(personId, format);
  a.download = `trace.${format === 'geojson' ? 'geojson' : format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
