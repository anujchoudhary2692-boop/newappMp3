import React, {createContext, useCallback, useContext, useMemo, useRef, useState} from 'react';
import type {PlayableMedia} from '../types/media';
import {formatTime} from '../utils/format';

export interface QueueTrack {
  id: string;
  media: PlayableMedia;
  streamUrl: string;
}

interface PlaybackCtx {
  media: PlayableMedia | null;
  streamUrl: string | null;
  paused: boolean;
  currentTime: number;
  duration: number;
  buffering: boolean;
  playbackRate: number;
  queue: QueueTrack[];
  queueIndex: number;
  repeat: boolean;
  shuffle: boolean;
  play: (media: PlayableMedia, streamUrl: string) => void;
  playQueue: (tracks: QueueTrack[], start?: number) => void;
  togglePause: () => void;
  seek: (t: number) => void;
  next: () => void;
  prev: () => void;
  setRate: (r: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  stop: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  onTimeUpdate: () => void;
  onLoaded: () => void;
  onEnded: () => void;
  onWaiting: () => void;
  onPlaying: () => void;
  formatCurrent: string;
  formatDuration: string;
}

const Ctx = createContext<PlaybackCtx | null>(null);

const RATES = [0.75, 1, 1.25, 1.5, 2];

export function PlaybackProvider({children}: {children: React.ReactNode}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [media, setMedia] = useState<PlayableMedia | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);

  const activeEl = () =>
    media?.type === 'VIDEO' ? videoRef.current : audioRef.current;

  const playTrack = useCallback((m: PlayableMedia, url: string) => {
    setMedia(m);
    setStreamUrl(url);
    setPaused(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(true);
  }, []);

  const play = useCallback(
    (m: PlayableMedia, url: string) => {
      setQueue([]);
      setQueueIndex(0);
      playTrack(m, url);
    },
    [playTrack],
  );

  const playQueue = useCallback(
    (tracks: QueueTrack[], start = 0) => {
      if (!tracks.length) return;
      setQueue(tracks);
      setQueueIndex(start);
      const t = tracks[start];
      playTrack(t.media, t.streamUrl);
    },
    [playTrack],
  );

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= queue.length) return;
      setQueueIndex(idx);
      playTrack(queue[idx].media, queue[idx].streamUrl);
    },
    [queue, playTrack],
  );

  const next = useCallback(() => {
    if (!queue.length) return;
    const n = queueIndex + 1;
    if (n < queue.length) goTo(n);
    else if (repeat) goTo(0);
  }, [queue, queueIndex, repeat, goTo]);

  const prev = useCallback(() => {
    if (currentTime > 3) {
      seek(0);
      return;
    }
    if (queueIndex > 0) goTo(queueIndex - 1);
  }, [currentTime, queueIndex, goTo]);

  const seek = useCallback((t: number) => {
    const el = activeEl();
    if (el) {
      el.currentTime = t;
      setCurrentTime(t);
    }
  }, [media]);

  const togglePause = useCallback(() => {
    const el = activeEl();
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  }, [media]);

  const setRate = useCallback(
    (r: number) => {
      setPlaybackRate(r);
      const el = activeEl();
      if (el) el.playbackRate = r;
    },
    [media],
  );

  const onTimeUpdate = useCallback(() => {
    const el = activeEl();
    if (el) setCurrentTime(el.currentTime);
  }, [media]);

  const onLoaded = useCallback(() => {
    const el = activeEl();
    if (el) {
      setDuration(el.duration || 0);
      el.playbackRate = playbackRate;
      setBuffering(false);
    }
  }, [media, playbackRate]);

  const onEnded = useCallback(() => next(), [next]);
  const onWaiting = useCallback(() => setBuffering(true), []);
  const onPlaying = useCallback(() => setBuffering(false), []);

  const stop = useCallback(() => {
    setMedia(null);
    setStreamUrl(null);
    setPaused(true);
    setQueue([]);
  }, []);

  const value = useMemo(
    () => ({
      media,
      streamUrl,
      paused,
      currentTime,
      duration,
      buffering,
      playbackRate,
      queue,
      queueIndex,
      repeat,
      shuffle,
      play,
      playQueue,
      togglePause,
      seek,
      next,
      prev,
      setRate,
      toggleRepeat: () => setRepeat(r => !r),
      toggleShuffle: () => setShuffle(s => !s),
      stop,
      audioRef,
      videoRef,
      onTimeUpdate,
      onLoaded,
      onEnded,
      onWaiting,
      onPlaying,
      formatCurrent: formatTime(currentTime),
      formatDuration: formatTime(duration),
    }),
    [
      media,
      streamUrl,
      paused,
      currentTime,
      duration,
      buffering,
      playbackRate,
      queue,
      queueIndex,
      repeat,
      shuffle,
      play,
      playQueue,
      togglePause,
      seek,
      next,
      prev,
      stop,
      onTimeUpdate,
      onLoaded,
      onEnded,
      onWaiting,
      onPlaying,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={media?.type === 'AUDIO' ? streamUrl ?? undefined : undefined}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoaded}
        onEnded={onEnded}
        onWaiting={onWaiting}
        onPlaying={onPlaying}
        onError={() => setBuffering(false)}
        preload="auto"
      />
    </Ctx.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayback outside provider');
  return ctx;
}

export {RATES};
