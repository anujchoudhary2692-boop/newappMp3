import type {MediaSearchResult} from '../features/media/domain/types';
import type {MediaQuality} from '../features/media/domain/qualityPresets';
import {downloadSearchItemToDevice} from './localMediaStore';

export type DownloadJobStatus = 'pending' | 'active' | 'done' | 'failed';

export interface DownloadJob {
  id: string;
  item: MediaSearchResult;
  type: 'AUDIO' | 'VIDEO';
  quality?: MediaQuality;
  status: DownloadJobStatus;
  progress: number;
  error?: string;
}

type Listener = () => void;

const jobs: DownloadJob[] = [];
const listeners = new Set<Listener>();
let processing = false;

function notify(): void {
  listeners.forEach(fn => fn());
}

function jobId(item: MediaSearchResult, type: 'AUDIO' | 'VIDEO', quality?: MediaQuality): string {
  return `${type}:${item.videoId}:${quality || 'default'}`;
}

export function subscribeDownloadQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDownloadQueue(): DownloadJob[] {
  return [...jobs];
}

export function getDownloadQueueStats(): {
  pending: number;
  active: number;
  done: number;
  failed: number;
} {
  return {
    pending: jobs.filter(j => j.status === 'pending').length,
    active: jobs.filter(j => j.status === 'active').length,
    done: jobs.filter(j => j.status === 'done').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };
}

export function enqueueDownload(
  item: MediaSearchResult,
  type: 'AUDIO' | 'VIDEO',
  quality?: MediaQuality,
): boolean {
  const id = jobId(item, type, quality);
  if (jobs.some(j => j.id === id && (j.status === 'pending' || j.status === 'active'))) {
    return false;
  }
  jobs.push({
    id,
    item,
    type,
    quality,
    status: 'pending',
    progress: 0,
  });
  notify();
  void processQueue();
  return true;
}

export function clearCompletedDownloads(): void {
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].status === 'done') {
      jobs.splice(i, 1);
    }
  }
  notify();
}

export function removeDownloadJob(id: string): void {
  const idx = jobs.findIndex(j => j.id === id);
  if (idx >= 0 && jobs[idx].status !== 'active') {
    jobs.splice(idx, 1);
    notify();
  }
}

async function processQueue(): Promise<void> {
  if (processing) {
    return;
  }
  processing = true;
  try {
    while (true) {
      const next = jobs.find(j => j.status === 'pending');
      if (!next) {
        break;
      }
      next.status = 'active';
      next.progress = 0;
      notify();
      try {
        await downloadSearchItemToDevice(
          next.item,
          next.type,
          progress => {
            next.progress = progress.percent;
            notify();
          },
          next.quality,
        );
        next.status = 'done';
        next.progress = 100;
      } catch (e) {
        next.status = 'failed';
        next.error = e instanceof Error ? e.message : 'Download failed';
      }
      notify();
    }
  } finally {
    processing = false;
  }
}
