import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {warmMediaServer} from './mediaPrefetch';
import {mediaApi} from '../features/media/api/mediaApi';
import type {MediaItem, MediaSearchResult} from '../features/media/domain/types';
import {getApiBaseUrl, getApiKey} from '../config';
import {mediaStreamHeaders, resolveStreamUrl} from './mediaPlayback';

export interface LocalMediaRecord {
  id: string;
  videoId: string;
  title: string;
  type: 'AUDIO' | 'VIDEO';
  localPath: string;
  fileName: string;
  fileSizeBytes: number;
  thumbnailUrl: string;
  downloadedAt: string;
  serverLibraryId?: string;
  sourceUrl?: string;
}

const INDEX_KEY = '@mediaface/local_media_index';

function mediaRootDir(): string {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/MediaFace`;
}

function typeDir(type: 'AUDIO' | 'VIDEO'): string {
  return type === 'AUDIO' ? `${mediaRootDir()}/audio` : `${mediaRootDir()}/video`;
}

function isLanBackend(base = getApiBaseUrl()): boolean {
  return base.startsWith('http://') && !base.includes('onrender.com');
}

function recordKey(videoId: string, type: 'AUDIO' | 'VIDEO'): string {
  return `${type}:${videoId}`;
}

function sanitizeFileName(title: string, videoId: string, ext: string): string {
  const safe = title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 48);
  return `${safe || 'media'}_${videoId}.${ext}`;
}

async function loadIndex(): Promise<LocalMediaRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as LocalMediaRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveIndex(records: LocalMediaRecord[]): Promise<void> {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(records));
}

async function mkdirIfMissing(dir: string): Promise<void> {
  const exists = await ReactNativeBlobUtil.fs.exists(dir);
  if (!exists) {
    await ReactNativeBlobUtil.fs.mkdir(dir);
  }
}

export async function ensureMediaDirs(): Promise<void> {
  const root = mediaRootDir();
  await mkdirIfMissing(root);
  await mkdirIfMissing(`${root}/audio`);
  await mkdirIfMissing(`${root}/video`);
}

export async function getLocalMediaRecord(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
): Promise<LocalMediaRecord | null> {
  const records = await loadIndex();
  const found = records.find(r => r.videoId === videoId && r.type === type);
  if (!found) {
    return null;
  }
  const exists = await ReactNativeBlobUtil.fs.exists(found.localPath);
  if (!exists) {
    return null;
  }
  return found;
}

export async function getLocalPlaybackUri(
  videoId: string,
  type: 'AUDIO' | 'VIDEO',
): Promise<string | null> {
  const record = await getLocalMediaRecord(videoId, type);
  if (!record) {
    return null;
  }
  return record.localPath.startsWith('file://')
    ? record.localPath
    : `file://${record.localPath}`;
}

export async function listLocalMedia(type?: 'AUDIO' | 'VIDEO'): Promise<LocalMediaRecord[]> {
  const records = await loadIndex();
  const filtered = type ? records.filter(r => r.type === type) : records;
  const valid: LocalMediaRecord[] = [];
  for (const record of filtered) {
    if (await ReactNativeBlobUtil.fs.exists(record.localPath)) {
      valid.push(record);
    }
  }
  return valid.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
}

export async function deleteLocalMedia(id: string): Promise<void> {
  const records = await loadIndex();
  const target = records.find(r => r.id === id);
  if (target) {
    await ReactNativeBlobUtil.fs.unlink(target.localPath).catch(() => undefined);
  }
  await saveIndex(records.filter(r => r.id !== id));
}

export async function getLocalStorageStats(): Promise<{
  fileCount: number;
  totalBytes: number;
  audioCount: number;
  videoCount: number;
}> {
  const records = await listLocalMedia();
  let totalBytes = 0;
  let audioCount = 0;
  let videoCount = 0;
  for (const record of records) {
    totalBytes += record.fileSizeBytes || 0;
    if (record.type === 'AUDIO') {
      audioCount += 1;
    } else {
      videoCount += 1;
    }
  }
  return {fileCount: records.length, totalBytes, audioCount, videoCount};
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function localRecordToMediaItem(record: LocalMediaRecord): MediaItem {
  return {
    id: record.id,
    title: record.title,
    sourceUrl: record.sourceUrl || `https://www.youtube.com/watch?v=${record.videoId}`,
    type: record.type,
    fileName: record.fileName,
    streamUrl: record.localPath.startsWith('file://')
      ? record.localPath
      : `file://${record.localPath}`,
    thumbnailUrl: record.thumbnailUrl,
    fileSizeBytes: record.fileSizeBytes,
    quality: record.type === 'AUDIO' ? 'On device · MP3/M4A' : 'On device · HD',
    downloadedAt: record.downloadedAt,
  };
}

export interface DownloadProgress {
  received: number;
  total: number;
  percent: number;
}

export async function downloadMediaToDevice(
  payload: {
    videoId: string;
    title: string;
    sourceUrl: string;
    type: 'AUDIO' | 'VIDEO';
    thumbnailUrl?: string;
  },
  onProgress?: (progress: DownloadProgress) => void,
): Promise<LocalMediaRecord> {
  await ensureMediaDirs();

  const existing = await getLocalMediaRecord(payload.videoId, payload.type);
  if (existing) {
    onProgress?.({received: existing.fileSizeBytes, total: existing.fileSizeBytes, percent: 100});
    return existing;
  }

  await warmMediaServer();
  if (!isLanBackend()) {
    const status = await mediaApi.status();
    if (status.success && status.data?.playDownload === 'LIMITED') {
      throw new Error(
        'Cloud needs YouTube cookies on Render.\n\n' +
          'On Mac run: ./scripts/export-youtube-cookies.sh\n' +
          'Paste into Render → YOUTUBE_COOKIES_BASE64\n\n' +
          'Or start Mac backend on same Wi‑Fi (auto-discovered).',
      );
    }
  }

  let response;
  try {
    response = await mediaApi.download({
      videoId: payload.videoId,
      title: payload.title,
      sourceUrl: payload.sourceUrl,
      type: payload.type,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Server download failed';
    throw new Error(msg);
  }

  if (!response.success || !response.data) {
    throw new Error(response.message || 'Server download failed');
  }

  const serverItem = response.data;
  const remoteUrl = resolveStreamUrl(serverItem.streamUrl);
  const ext = serverItem.fileName.includes('.')
    ? serverItem.fileName.split('.').pop() || (payload.type === 'AUDIO' ? 'm4a' : 'mp4')
    : payload.type === 'AUDIO'
      ? 'm4a'
      : 'mp4';
  const fileName = sanitizeFileName(payload.title, payload.videoId, ext);
  const localPath = `${typeDir(payload.type)}/${fileName}`;

  const headers = mediaStreamHeaders(remoteUrl);
  const apiKey = getApiKey();
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const task = ReactNativeBlobUtil.config({
    path: localPath,
    fileCache: true,
  }).fetch('GET', remoteUrl, headers);

  task.progress((received, total) => {
    const r = Number(received);
    const t = Number(total);
    onProgress?.({
      received: r,
      total: t,
      percent: t > 0 ? Math.min(100, Math.round((r / t) * 100)) : 0,
    });
  });

  let result;
  try {
    result = await task;
  } catch (error) {
    const hint = error instanceof Error ? error.message : 'Could not save file on device';
    throw new Error(
      `Saved on server but phone copy failed: ${hint}. You can still play from your library while online.`,
    );
  }
  const stat = await ReactNativeBlobUtil.fs.stat(result.path());
  const record: LocalMediaRecord = {
    id: serverItem.id || recordKey(payload.videoId, payload.type),
    videoId: payload.videoId,
    title: payload.title,
    type: payload.type,
    localPath: result.path(),
    fileName,
    fileSizeBytes: Number(stat.size) || serverItem.fileSizeBytes || 0,
    thumbnailUrl: payload.thumbnailUrl || serverItem.thumbnailUrl,
    downloadedAt: new Date().toISOString(),
    serverLibraryId: serverItem.id,
    sourceUrl: payload.sourceUrl,
  };

  const records = await loadIndex();
  const next = [
    record,
    ...records.filter(r => !(r.videoId === payload.videoId && r.type === payload.type)),
  ];
  await saveIndex(next);
  onProgress?.({received: record.fileSizeBytes, total: record.fileSizeBytes, percent: 100});
  return record;
}

export async function downloadSearchItemToDevice(
  item: MediaSearchResult,
  type: 'AUDIO' | 'VIDEO',
  onProgress?: (progress: DownloadProgress) => void,
): Promise<LocalMediaRecord> {
  return downloadMediaToDevice(
    {
      videoId: item.videoId,
      title: item.title,
      sourceUrl: item.sourceUrl,
      type,
      thumbnailUrl: item.thumbnailUrl,
    },
    onProgress,
  );
}
