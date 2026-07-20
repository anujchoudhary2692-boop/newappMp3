import {NativeModules, Platform} from 'react-native';

type RemoteHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (position: number) => void;
};

type MusicControlModule = {
  setNowPlaying: (info: Record<string, unknown>) => void;
  updatePlayback: (info: Record<string, unknown>) => void;
  resetNowPlaying: () => void;
  enableControl: (name: string, enabled: boolean) => void;
  enableBackgroundMode: (enabled: boolean) => void;
  handleAudioInterruptions: (enabled: boolean) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  OFF: number;
  STATE_PLAYING: number;
  STATE_PAUSED: number;
};

let MusicControl: MusicControlModule | null = null;

let initialized = false;
let handlers: RemoteHandlers | null = null;

function hasMusicControlNative(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  const modules = NativeModules as Record<string, unknown>;
  return !!(modules.MusicControlManager || modules.MusicControl);
}

export function initNowPlayingControls(): boolean {
  if (initialized) {
    return MusicControl != null;
  }
  initialized = true;
  if (!hasMusicControlNative()) {
    MusicControl = null;
    return false;
  }
  try {
    const mod = require('react-native-music-control').default as MusicControlModule;
    MusicControl = mod;
    // Avoid enableBackgroundMode on cold start — it spams MRNowPlaying entitlement
    // warnings in Debug builds before any track is playing.
    mod.enableControl('play', true);
    mod.enableControl('pause', true);
    mod.enableControl('nextTrack', true);
    mod.enableControl('previousTrack', true);
    mod.enableControl('changePlaybackPosition', true);
    mod.enableControl('seekForward', false);
    mod.enableControl('seekBackward', false);

    mod.on('play', () => handlers?.onPlay());
    mod.on('pause', () => handlers?.onPause());
    mod.on('nextTrack', () => handlers?.onNext());
    mod.on('previousTrack', () => handlers?.onPrevious());
    mod.on('seek', (pos: unknown) => {
      if (typeof pos === 'number') {
        handlers?.onSeek(pos);
      }
    });
    return true;
  } catch {
    MusicControl = null;
    return false;
  }
}

export function bindNowPlayingHandlers(next: RemoteHandlers | null): void {
  handlers = next;
}

let backgroundArmed = false;

function armBackgroundMode(): void {
  if (backgroundArmed || !MusicControl) {
    return;
  }
  backgroundArmed = true;
  try {
    MusicControl.enableBackgroundMode(true);
    MusicControl.handleAudioInterruptions(true);
  } catch {
    // Debug builds often lack mediaremote entitlements — keep playing in-app.
  }
}

export function updateNowPlaying(info: {
  title: string;
  artist?: string;
  artwork?: string;
  duration: number;
  elapsed: number;
  isPlaying: boolean;
  hasNext?: boolean;
  hasPrevious?: boolean;
}): void {
  if (!MusicControl) {
    initNowPlayingControls();
  }
  const mc = MusicControl;
  if (!mc) {
    return;
  }
  armBackgroundMode();
  try {
    const state = info.isPlaying ? mc.STATE_PLAYING : mc.STATE_PAUSED;
    mc.setNowPlaying({
      title: info.title,
      artist: info.artist || 'MediaFace',
      artwork: info.artwork || undefined,
      duration: Math.max(info.duration, 0),
      elapsedTime: Math.max(info.elapsed, 0),
      description: 'MediaFace',
      color: 0xff9900,
      colorized: true,
    });
    mc.updatePlayback({
      state,
      elapsedTime: Math.max(info.elapsed, 0),
      speed: 1,
    });
    mc.enableControl('nextTrack', !!info.hasNext);
    mc.enableControl('previousTrack', !!info.hasPrevious);
  } catch {
    // Ignore missing Debug entitlements (com.apple.mediaremote.set-playback-state).
  }
}

export function clearNowPlaying(): void {
  try {
    MusicControl?.resetNowPlaying();
  } catch {
    // ignore
  }
}
