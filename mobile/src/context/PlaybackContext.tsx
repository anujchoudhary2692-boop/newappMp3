import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import Video, {OnLoadData, OnProgressData, VideoRef} from 'react-native-video';
import {StyleSheet, View} from 'react-native';
import {PlayableMedia} from '../api/client';
import {isPlayerScreenOpen, openPlayerScreen} from '../navigation/navigationRef';
import {buildMediaSource} from '../utils/mediaPlayback';
import {pushRecentMedia} from '../utils/recentMedia';

export interface QueueTrack {
  id: string;
  media: PlayableMedia;
  streamUrl: string;
}

interface PlaybackContextValue {
  media: PlayableMedia | null;
  streamUrl: string | null;
  paused: boolean;
  currentTime: number;
  duration: number;
  buffering: boolean;
  engineActive: boolean;
  queueIndex: number;
  queueLength: number;
  repeatQueue: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  playbackRate: number;
  queueTracks: QueueTrack[];
  play: (media: PlayableMedia, streamUrl: string) => void;
  playQueue: (tracks: QueueTrack[], startIndex: number) => void;
  playQueueIndex: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleRepeatQueue: () => void;
  cyclePlaybackRate: () => void;
  setPlaybackRate: (rate: number) => void;
  onTrackEnd: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  togglePause: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  syncFromRoute: (media: PlayableMedia, streamUrl: string) => void;
  deactivateEngine: () => void;
  activateEngine: (resumeAt?: number) => void;
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

export function usePlayback() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error('usePlayback must be used within PlaybackProvider');
  }
  return ctx;
}

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2];

export function PlaybackProvider({children}: {children: React.ReactNode}) {
  const videoRef = useRef<VideoRef>(null);
  const pendingSeek = useRef(0);
  const queueRef = useRef<QueueTrack[]>([]);
  const queueIndexRef = useRef(-1);
  const repeatQueueRef = useRef(false);
  const [media, setMedia] = useState<PlayableMedia | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const [engineActive, setEngineActive] = useState(true);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [queueLength, setQueueLength] = useState(0);
  const [repeatQueue, setRepeatQueue] = useState(false);
  const [queueTracks, setQueueTracks] = useState<QueueTrack[]>([]);
  const [playbackRate, setPlaybackRateState] = useState(1);

  repeatQueueRef.current = repeatQueue;

  const clearQueue = useCallback(() => {
    queueRef.current = [];
    queueIndexRef.current = -1;
    setQueueIndex(-1);
    setQueueLength(0);
    setQueueTracks([]);
  }, []);

  const applyTrack = useCallback((nextMedia: PlayableMedia, nextStreamUrl: string) => {
    setMedia(nextMedia);
    setStreamUrl(nextStreamUrl);
    setPaused(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(true);
    setStreamKey(key => key + 1);
    void pushRecentMedia(nextMedia, nextStreamUrl);
  }, []);

  const goToQueueIndex = useCallback((index: number) => {
    const queue = queueRef.current;
    if (index < 0 || index >= queue.length) {
      return false;
    }
    queueIndexRef.current = index;
    setQueueIndex(index);
    const track = queue[index];
    applyTrack(track.media, track.streamUrl);
    if (isPlayerScreenOpen()) {
      openPlayerScreen(track.media, track.streamUrl);
    }
    return true;
  }, [applyTrack]);

  const play = useCallback((nextMedia: PlayableMedia, nextStreamUrl: string) => {
    const same =
      media?.title === nextMedia.title &&
      media?.streamUrl === nextMedia.streamUrl &&
      streamUrl === nextStreamUrl;

    if (same) {
      setPaused(false);
      return;
    }

    clearQueue();
    applyTrack(nextMedia, nextStreamUrl);
  }, [applyTrack, clearQueue, media, streamUrl]);

  const playQueue = useCallback((tracks: QueueTrack[], startIndex: number) => {
    if (tracks.length === 0 || startIndex < 0 || startIndex >= tracks.length) {
      return;
    }
    queueRef.current = tracks;
    queueIndexRef.current = startIndex;
    setQueueIndex(startIndex);
    setQueueLength(tracks.length);
    setQueueTracks(tracks);
    const track = tracks[startIndex];
    applyTrack(track.media, track.streamUrl);
  }, [applyTrack]);

  const playQueueIndex = useCallback((index: number) => {
    goToQueueIndex(index);
  }, [goToQueueIndex]);

  const cyclePlaybackRate = useCallback(() => {
    setPlaybackRateState(current => {
      const idx = PLAYBACK_RATES.indexOf(current);
      const next = PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
      return next;
    });
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
  }, []);

  const playNext = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length === 0) {
      return;
    }
    const nextIdx = queueIndexRef.current + 1;
    if (nextIdx < queue.length) {
      goToQueueIndex(nextIdx);
      return;
    }
    if (repeatQueueRef.current) {
      goToQueueIndex(0);
    }
  }, [goToQueueIndex]);

  const playPrevious = useCallback(() => {
    const prevIdx = queueIndexRef.current - 1;
    if (prevIdx >= 0) {
      goToQueueIndex(prevIdx);
    }
  }, [goToQueueIndex]);

  const toggleRepeatQueue = useCallback(() => {
    setRepeatQueue(value => !value);
  }, []);

  const onTrackEnd = useCallback(() => {
    const nextIdx = queueIndexRef.current + 1;
    const queue = queueRef.current;

    if (nextIdx >= queue.length) {
      if (repeatQueueRef.current && queue.length > 0) {
        goToQueueIndex(0);
      } else {
        clearQueue();
        setPaused(true);
      }
      return;
    }

    goToQueueIndex(nextIdx);
  }, [clearQueue, goToQueueIndex]);

  const syncFromRoute = useCallback((nextMedia: PlayableMedia, nextStreamUrl: string) => {
    const same = media?.title === nextMedia.title && streamUrl === nextStreamUrl;

    if (!same) {
      setMedia(nextMedia);
      setStreamUrl(nextStreamUrl);
      setStreamKey(key => key + 1);
      setBuffering(true);
    }
    setPaused(false);
  }, [media, streamUrl]);

  const stop = useCallback(() => {
    clearQueue();
    setRepeatQueue(false);
    setMedia(null);
    setStreamUrl(null);
    setPaused(true);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(false);
    setEngineActive(true);
    pendingSeek.current = 0;
  }, [clearQueue]);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  const togglePause = useCallback(() => {
    setPaused(value => !value);
  }, []);

  const deactivateEngine = useCallback(() => {
    setEngineActive(false);
    setPaused(true);
  }, []);

  const activateEngine = useCallback((resumeAt = 0) => {
    pendingSeek.current = resumeAt;
    setCurrentTime(resumeAt);
    setEngineActive(true);
    setStreamKey(key => key + 1);
    setPaused(false);
    setBuffering(true);
  }, []);

  const seekBy = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(duration || 0, currentTime + seconds));
    videoRef.current?.seek(next);
    setCurrentTime(next);
  }, [currentTime, duration]);

  const seekTo = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(duration || 0, seconds));
    videoRef.current?.seek(next);
    setCurrentTime(next);
  }, [duration]);

  const onLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setBuffering(false);
    if (pendingSeek.current > 0) {
      const target = pendingSeek.current;
      pendingSeek.current = 0;
      videoRef.current?.seek(target);
      setCurrentTime(target);
    }
  }, []);

  const onProgress = useCallback((data: OnProgressData) => {
    setCurrentTime(data.currentTime);
  }, []);

  const hasNext =
    queueLength > 0 &&
    (queueIndex < queueLength - 1 || repeatQueue);
  const hasPrevious = queueLength > 0 && queueIndex > 0;

  const value = useMemo(
    () => ({
      media,
      streamUrl,
      paused,
      currentTime,
      duration,
      buffering,
      engineActive,
      queueIndex,
      queueLength,
      repeatQueue,
      hasNext,
      hasPrevious,
      playbackRate,
      queueTracks,
      play,
      playQueue,
      playQueueIndex,
      playNext,
      playPrevious,
      toggleRepeatQueue,
      cyclePlaybackRate,
      setPlaybackRate,
      onTrackEnd,
      stop,
      pause,
      resume,
      togglePause,
      seekBy,
      seekTo,
      syncFromRoute,
      deactivateEngine,
      activateEngine,
    }),
    [
      media,
      streamUrl,
      paused,
      currentTime,
      duration,
      buffering,
      engineActive,
      queueIndex,
      queueLength,
      repeatQueue,
      hasNext,
      hasPrevious,
      playbackRate,
      queueTracks,
      play,
      playQueue,
      playQueueIndex,
      playNext,
      playPrevious,
      toggleRepeatQueue,
      cyclePlaybackRate,
      setPlaybackRate,
      onTrackEnd,
      stop,
      pause,
      resume,
      togglePause,
      seekBy,
      seekTo,
      syncFromRoute,
      deactivateEngine,
      activateEngine,
    ],
  );

  const videoSource = streamUrl && engineActive
    ? buildMediaSource(streamUrl, media?.type === 'VIDEO' ? 'VIDEO' : 'AUDIO')
    : null;

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      {videoSource ? (
        <View pointerEvents="none" style={styles.hiddenHost}>
          <Video
            ref={videoRef}
            key={streamKey}
            source={videoSource}
            style={styles.hiddenVideo}
            paused={paused}
            rate={playbackRate}
            playInBackground
            playWhenInactive
            ignoreSilentSwitch="ignore"
            bufferConfig={{
              minBufferMs: 800,
              maxBufferMs: 12000,
              bufferForPlaybackMs: 250,
              bufferForPlaybackAfterRebufferMs: 500,
            }}
            onLoad={onLoad}
            onProgress={onProgress}
            onBuffer={({isBuffering}) => setBuffering(isBuffering)}
            onEnd={onTrackEnd}
            onError={e => {
              setBuffering(false);
              setPaused(true);
              console.warn('Playback engine error', e);
            }}
            onAudioBecomingNoisy={() => setPaused(true)}
          />
        </View>
      ) : null}
    </PlaybackContext.Provider>
  );
}

const styles = StyleSheet.create({
  hiddenHost: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenVideo: {
    width: 1,
    height: 1,
  },
});
