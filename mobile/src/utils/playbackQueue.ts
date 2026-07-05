import {api, MediaItem, PlayableMedia} from '../api/client';
import {QueueTrack} from '../context/PlaybackContext';
import {getLocalPlaybackUri} from './localMediaStore';
import {resolveStreamUrl} from './mediaPlayback';
import {extractYouTubeVideoId} from './youtubeUrl';

function extractVideoId(sourceUrl?: string): string | null {
  if (!sourceUrl) {
    return null;
  }
  return extractYouTubeVideoId(sourceUrl);
}

export async function libraryItemToTrack(item: MediaItem): Promise<QueueTrack> {
  const videoId = extractVideoId(item.sourceUrl);
  if (videoId) {
    const localUri = await getLocalPlaybackUri(videoId, item.type);
    if (localUri) {
      const media: PlayableMedia = {
        title: item.title,
        type: item.type,
        streamUrl: localUri,
        thumbnailUrl: item.thumbnailUrl,
        quality: 'On device · Offline',
        sourceUrl: item.sourceUrl,
        videoId,
        libraryId: item.id,
      };
      return {id: item.id, media, streamUrl: localUri};
    }
  }

  const streamUrl = item.streamUrl.startsWith('file://')
    ? item.streamUrl
    : api.getStreamUrl(item.streamUrl);
  const media: PlayableMedia = {
    title: item.title,
    type: item.type,
    streamUrl,
    thumbnailUrl: item.thumbnailUrl,
    quality: item.quality,
    sourceUrl: item.sourceUrl,
    videoId: videoId || undefined,
    libraryId: item.id,
  };
  return {id: item.id, media, streamUrl};
}

export async function buildLibraryQueue(items: MediaItem[]): Promise<QueueTrack[]> {
  return Promise.all(items.map(libraryItemToTrack));
}

export async function resolveLibraryStreamUrl(item: MediaItem): Promise<string> {
  if (item.streamUrl.startsWith('file://')) {
    return item.streamUrl;
  }
  const videoId = extractVideoId(item.sourceUrl);
  if (videoId) {
    const localUri = await getLocalPlaybackUri(videoId, item.type);
    if (localUri) {
      return localUri;
    }
  }
  return resolveStreamUrl(item.streamUrl);
}
