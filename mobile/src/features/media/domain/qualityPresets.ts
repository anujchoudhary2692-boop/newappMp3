export type AudioQuality = '128' | '320' | 'm4a';
export type VideoQuality = '360' | '720' | '1080';
export type MediaQuality = AudioQuality | VideoQuality;

export interface QualityOption<T extends string = string> {
  id: T;
  label: string;
  subtitle: string;
}

export const AUDIO_QUALITY_OPTIONS: QualityOption<AudioQuality>[] = [
  {id: '128', label: 'MP3 · 128 kbps', subtitle: 'Smaller file · faster download'},
  {id: '320', label: 'MP3 · 320 kbps', subtitle: 'Recommended · best audio'},
  {id: 'm4a', label: 'M4A · High quality', subtitle: 'Original stream quality'},
];

export const VIDEO_QUALITY_OPTIONS: QualityOption<VideoQuality>[] = [
  {id: '360', label: 'MP4 · 360p', subtitle: 'Fast · saves data'},
  {id: '720', label: 'MP4 · 720p HD', subtitle: 'Recommended · sharp on phone'},
  {id: '1080', label: 'MP4 · 1080p Full HD', subtitle: 'Best quality · larger file'},
];

export function defaultQuality(type: 'AUDIO' | 'VIDEO'): MediaQuality {
  return type === 'AUDIO' ? '320' : '720';
}

export function qualityLabel(type: 'AUDIO' | 'VIDEO', quality: MediaQuality): string {
  const options = type === 'AUDIO' ? AUDIO_QUALITY_OPTIONS : VIDEO_QUALITY_OPTIONS;
  return options.find(o => o.id === quality)?.label ?? String(quality);
}
