declare module 'react-native-music-control' {
  const MusicControl: {
    setNowPlaying: (info: Record<string, unknown>) => void;
    updatePlayback: (info: Record<string, unknown>) => void;
    resetNowPlaying: () => void;
    enableControl: (controlName: string, enabled: boolean) => void;
    enableBackgroundMode: (enabled: boolean) => void;
    handleAudioInterruptions: (enabled: boolean) => void;
    on: (controlName: string, callback: (...args: unknown[]) => void) => void;
    OFF: number;
    STATE_PLAYING: number;
    STATE_PAUSED: number;
    STATE_STOPPED: number;
  };
  export default MusicControl;
}
