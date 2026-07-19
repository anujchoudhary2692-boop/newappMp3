/**
 * Media playback application service — orchestrates local cache, server prepare, and player attach.
 * UI layers should call this instead of raw API + utils.
 */
export {
  prepareAndStartPlayback,
  prepareQueueTrack,
  waitForMediaReady,
  saveMediaToDevice,
  saveSearchItemToDevice,
  showPlaybackError,
  showDownloadError,
} from '../../../utils/playSearchItem';

export type {PlaybackController, DownloadProgress} from '../../../utils/playSearchItem';
