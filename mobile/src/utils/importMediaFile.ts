import {Alert, Platform} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ensureMediaDirs,
  listLocalMedia,
  type LocalMediaRecord,
} from './localMediaStore';

const INDEX_KEY = '@mediaface/local_media_index';

function mediaRootDir(): string {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/MediaFace`;
}

function typeDir(type: 'AUDIO' | 'VIDEO'): string {
  return type === 'AUDIO' ? `${mediaRootDir()}/audio` : `${mediaRootDir()}/video`;
}

function guessType(name: string): 'AUDIO' | 'VIDEO' {
  const lower = name.toLowerCase();
  if (/\.(mp4|mov|m4v|webm|mkv|avi)$/.test(lower)) {
    return 'VIDEO';
  }
  return 'AUDIO';
}

function extFromName(name: string, type: 'AUDIO' | 'VIDEO'): string {
  const match = name.match(/\.([a-z0-9]+)$/i);
  if (match) {
    return match[1].toLowerCase();
  }
  return type === 'AUDIO' ? 'mp3' : 'mp4';
}

function sanitizeImportName(name: string): string {
  return name.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '_').slice(0, 64) || 'import';
}

async function appendRecord(record: LocalMediaRecord): Promise<void> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  const records: LocalMediaRecord[] = raw ? JSON.parse(raw) : [];
  const next = [record, ...records.filter(r => r.localPath !== record.localPath)];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
}

/** Import audio/video from device Files app into MediaFace storage. */
export async function importMediaFromFiles(): Promise<LocalMediaRecord[]> {
  let DocumentPicker: typeof import('react-native-document-picker').default;
  try {
    DocumentPicker = (await import('react-native-document-picker')).default;
  } catch {
    Alert.alert(
      'Import unavailable',
      'Rebuild the app after installing react-native-document-picker:\nnpm install && cd ios && pod install',
    );
    return [];
  }

  const picks = await DocumentPicker.pick({
    allowMultiSelection: true,
    type: [DocumentPicker.types.audio, DocumentPicker.types.video],
    copyTo: 'documentDirectory',
  }).catch(err => {
    if (DocumentPicker.isCancel(err)) {
      return [];
    }
    throw err;
  });

  if (!picks.length) {
    return [];
  }

  await ensureMediaDirs();
  const imported: LocalMediaRecord[] = [];

  for (const file of picks) {
    const sourceUri = file.fileCopyUri || file.uri;
    if (!sourceUri) {
      continue;
    }
    const fileName = file.name || `import_${Date.now()}`;
    const type = guessType(fileName);
    const ext = extFromName(fileName, type);
    const safe = sanitizeImportName(fileName.replace(/\.[^.]+$/, ''));
    const importId = `import_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const destPath = `${typeDir(type)}/${safe}_${importId}.${ext}`;

    const decoded = decodeURIComponent(sourceUri.replace(/^file:\/\//, ''));
    if (Platform.OS === 'ios' && sourceUri.startsWith('file://')) {
      await ReactNativeBlobUtil.fs.cp(decoded, destPath);
    } else {
      await ReactNativeBlobUtil.fs.cp(sourceUri, destPath);
    }

    const stat = await ReactNativeBlobUtil.fs.stat(destPath);
    const record: LocalMediaRecord = {
      id: `${type}:${importId}`,
      videoId: importId,
      title: fileName.replace(/\.[^.]+$/, ''),
      type,
      localPath: destPath,
      fileName: `${safe}_${importId}.${ext}`,
      fileSizeBytes: Number(stat.size) || 0,
      thumbnailUrl: '',
      downloadedAt: new Date().toISOString(),
      quality: type === 'AUDIO' ? 'Imported · MP3/M4A' : 'Imported · MP4',
    };
    await appendRecord(record);
    imported.push(record);
  }

  return imported;
}

export async function findImportedByPath(localPath: string): Promise<LocalMediaRecord | null> {
  const records = await listLocalMedia();
  return records.find(r => r.localPath === localPath) ?? null;
}
