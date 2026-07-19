import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useLocation} from 'react-router-dom';
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
  error: string | null;
  prepareStatus: string | null;
  queue: QueueTrack[];
  queueIndex: number;
  repeat: boolean;
  shuffle: boolean;
  onPlayerPage: boolean;
  play: (media: PlayableMedia, streamUrl: string) => void;
  beginPrepare: (media: PlayableMedia) => void;
  setPrepareStatus: (msg: string) => void;
  failPrepare: (msg: string) => void;
  playQueue: (tracks: QueueTrack[], start?: number) => void;
  addToQueue: (track: QueueTrack) => void;
  playNextInsert: (track: QueueTrack) => void;
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
  onPauseEvt: () => void;
  onError: () => void;
  formatCurrent: string;
  formatDuration: string;
}

const Ctx = createContext<PlaybackCtx | null>(null);

export const RATES = [0.75, 1, 1.25, 1.5, 2];

export function PlaybackProvider({children}: {children: React.ReactNode}) {
  const location = useLocation();
  const onPlayerPage = location.pathname === '/player';
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [media, setMedia] = useState<PlayableMedia | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [prepareStatus, setPrepareStatus] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [repeat, setRepeat] = useState(false);
  const [shuffle, setShuffle] = useState(false);

  const activeEl = useCallback((): HTMLMediaElement | null => {
    if (media?.type === 'VIDEO') return videoRef.current;
    return audioRef.current;
  }, [media?.type]);

  const tryPlay = useCallback(() => {
    const el = activeEl();
    if (!el || paused) return;
    void el.play().catch(() => setPaused(true));
  }, [activeEl, paused]);

  const playTrack = useCallback((m: PlayableMedia, url: string) => {
    setMedia(m);
    setStreamUrl(url);
    setPaused(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(true);
    setError(null);
    setPrepareStatus(null);
  }, []);

  const beginPrepare = useCallback((m: PlayableMedia) => {
    audioRef.current?.pause();
    videoRef.current?.pause();
    setMedia(m);
    setStreamUrl(null);
    setPaused(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(true);
    setError(null);
    setPrepareStatus('Getting stream ready…');
  }, []);

  const addToQueue = useCallback((track: QueueTrack) => {
    setQueue(q => [...q, track]);
  }, []);

  const playNextInsert = useCallback(
    (track: QueueTrack) => {
      if (!media || !streamUrl) {
        setQueue([track]);
        setQueueIndex(0);
        playTrack(track.media, track.streamUrl);
        return;
      }
      setQueue(q => {
        if (!q.length) {
          const current: QueueTrack = {
            id: media.videoId || media.streamUrl || media.title,
            media,
            streamUrl,
          };
          return [current, track];
        }
        const next = [...q];
        next.splice(queueIndex + 1, 0, track);
        return next;
      });
    },
    [queueIndex, media, streamUrl, playTrack],
  );

  const failPrepare = useCallback((msg: string) => {
    setBuffering(false);
    setPrepareStatus(null);
    setError(msg);
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
      playTrack(tracks[start].media, tracks[start].streamUrl);
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

  const seek = useCallback(
    (t: number) => {
      const el = activeEl();
      if (el) {
        el.currentTime = t;
        setCurrentTime(t);
      }
    },
    [activeEl],
  );

  const next = useCallback(() => {
    if (!queue.length) {
      if (repeat && media && streamUrl) {
        seek(0);
        setPaused(false);
        tryPlay();
      }
      return;
    }
    if (shuffle && queue.length > 1) {
      let idx = queueIndex;
      while (idx === queueIndex) {
        idx = Math.floor(Math.random() * queue.length);
      }
      goTo(idx);
      return;
    }
    const n = queueIndex + 1;
    if (n < queue.length) goTo(n);
    else if (repeat) goTo(0);
  }, [queue, queueIndex, repeat, shuffle, goTo, media, streamUrl, seek, tryPlay]);

  const prev = useCallback(() => {
    if (currentTime > 3) {
      seek(0);
      return;
    }
    if (queueIndex > 0) goTo(queueIndex - 1);
  }, [currentTime, queueIndex, goTo, seek]);

  const togglePause = useCallback(() => {
    const el = activeEl();
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPaused(false)).catch(() => setError('Tap play to start'));
    } else {
      el.pause();
      setPaused(true);
    }
  }, [activeEl]);

  const setRate = useCallback(
    (r: number) => {
      setPlaybackRate(r);
      const el = activeEl();
      if (el) el.playbackRate = r;
    },
    [activeEl],
  );

  const stop = useCallback(() => {
    audioRef.current?.pause();
    videoRef.current?.pause();
    setMedia(null);
    setStreamUrl(null);
    setPaused(true);
    setQueue([]);
    setError(null);
    setPrepareStatus(null);
  }, []);

  const onTimeUpdate = useCallback(() => {
    const el = activeEl();
    if (el) setCurrentTime(el.currentTime);
  }, [activeEl]);

  const onLoaded = useCallback(() => {
    const el = activeEl();
    if (el) {
      setDuration(el.duration || 0);
      el.playbackRate = playbackRate;
      setBuffering(false);
      if (!paused) tryPlay();
    }
  }, [activeEl, playbackRate, paused, tryPlay]);

  const onEnded = useCallback(() => next(), [next]);
  const onWaiting = useCallback(() => setBuffering(true), []);
  const onPlaying = useCallback(() => {
    setPaused(false);
    setBuffering(false);
    setError(null);
  }, []);
  const onPauseEvt = useCallback(() => setPaused(true), []);
  const onError = useCallback(
    () => setError('Playback failed — try ▶ Audio or another track'),
    [],
  );

  useEffect(() => {
    const el = activeEl();
    if (!el || !streamUrl) return;
    el.load();
    if (!paused) {
      const t = window.setTimeout(() => tryPlay(), 100);
      return () => window.clearTimeout(t);
    }
  }, [streamUrl, media?.type, activeEl, paused, tryPlay]);

  useEffect(() => {
    if (onPlayerPage && !paused && streamUrl) tryPlay();
  }, [onPlayerPage, paused, streamUrl, tryPlay]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !media) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: media.title,
      artist: media.quality || media.type,
      artwork: media.thumbnailUrl
        ? [{src: media.thumbnailUrl, sizes: '512x512', type: 'image/jpeg'}]
        : [],
    });
    navigator.mediaSession.setActionHandler('play', () => {
      setPaused(false);
      tryPlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      activeEl()?.pause();
      setPaused(true);
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekto', details => {
      if (details.seekTime != null) seek(details.seekTime);
    });
    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      } catch {
        // ignore
      }
    };
  }, [media, tryPlay, prev, next, seek, activeEl]);

  const value = useMemo(
    () => ({
      media,
      streamUrl,
      paused,
      currentTime,
      duration,
      buffering,
      playbackRate,
      error,
      prepareStatus,
      queue,
      queueIndex,
      repeat,
      shuffle,
      onPlayerPage,
      play,
      beginPrepare,
      setPrepareStatus,
      failPrepare,
      playQueue,
      addToQueue,
      playNextInsert,
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
      onPauseEvt,
      onError,
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
      error,
      prepareStatus,
      queue,
      queueIndex,
      repeat,
      shuffle,
      onPlayerPage,
      play,
      beginPrepare,
      setPrepareStatus,
      failPrepare,
      playQueue,
      addToQueue,
      playNextInsert,
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
      onPauseEvt,
      onError,
    ],
  );

  const mediaEvents = {
    onTimeUpdate,
    onLoadedMetadata: onLoaded,
    onEnded,
    onWaiting,
    onPlaying,
    onPause: onPauseEvt,
    onError,
  };

  const showVideo = media?.type === 'VIDEO';
  const videoSrc = showVideo && streamUrl ? streamUrl : undefined;
  const audioSrc = media?.type === 'AUDIO' && streamUrl ? streamUrl : undefined;

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        playsInline
        {...mediaEvents}
      />
      <video
        ref={videoRef}
        className={
          showVideo && streamUrl
            ? onPlayerPage
              ? 'player-video player-video--active'
              : 'player-video player-video--hidden'
            : 'player-video player-video--hidden'
        }
        src={videoSrc}
        poster={media?.thumbnailUrl}
        preload="auto"
        playsInline
        controls={onPlayerPage && showVideo && !!streamUrl}
        {...mediaEvents}
      />
    </Ctx.Provider>
  );
}

export function usePlayback() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayback outside provider');
  return ctx;
}
