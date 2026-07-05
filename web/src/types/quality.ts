export type AudioQuality = '128' | '320' | 'm4a';
export type VideoQuality = '360' | '720' | '1080';
export type MediaQuality = AudioQuality | VideoQuality;

export const AUDIO_OPTIONS = [
  {id: '128' as const, label: 'MP3 · 128 kbps', sub: 'Smaller · faster'},
  {id: '320' as const, label: 'MP3 · 320 kbps', sub: 'Recommended'},
  {id: 'm4a' as const, label: 'M4A · High quality', sub: 'Best stream'},
];

export const VIDEO_OPTIONS = [
  {id: '360' as const, label: 'MP4 · 360p', sub: 'Fast · saves data'},
  {id: '720' as const, label: 'MP4 · 720p HD', sub: 'Recommended'},
  {id: '1080' as const, label: 'MP4 · 1080p', sub: 'Best quality'},
];

export function defaultQuality(type: MediaType): MediaQuality {
  return type === 'AUDIO' ? '320' : '720';
}

type MediaType = 'AUDIO' | 'VIDEO';

export function qualityLabel(type: MediaType, q: MediaQuality): string {
  const opts = type === 'AUDIO' ? AUDIO_OPTIONS : VIDEO_OPTIONS;
  return opts.find(o => o.id === q)?.label ?? q;
}
