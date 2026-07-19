import type {MediaSearchResult} from '../types/media';
import {formatDuration} from '../utils/format';

interface Props {
  item: MediaSearchResult;
  playing?: boolean;
  onPlay: (type: 'AUDIO' | 'VIDEO') => void;
  onDownload: (type: 'AUDIO' | 'VIDEO') => void;
  onFavorite?: (type: 'AUDIO' | 'VIDEO') => void;
  onPlaylist?: () => void;
  onQueue?: (type: 'AUDIO' | 'VIDEO') => void;
  onPlayNext?: (type: 'AUDIO' | 'VIDEO') => void;
  onPrefetch?: () => void;
  favAudio?: boolean;
  favVideo?: boolean;
}

export function MediaCard({
  item,
  playing,
  onPlay,
  onDownload,
  onFavorite,
  onPlaylist,
  onQueue,
  onPlayNext,
  onPrefetch,
  favAudio,
  favVideo,
}: Props) {
  const hasVideo = item.hasVideo !== false;

  return (
    <article className="card" onMouseEnter={onPrefetch} onFocus={onPrefetch}>
      <img src={item.thumbnailUrl} alt={item.title} loading="lazy" />
      <div className="card-body">
        <div className="card-title">{item.title}</div>
        <div className="card-sub">
          {item.source ? `${item.source} · ` : ''}
          {item.channel}
          {item.durationSeconds ? ` · ${formatDuration(item.durationSeconds)}` : ''}
          {!hasVideo ? ' · Audio only' : ''}
        </div>
      </div>
      <div className="card-actions">
        <button className="btn btn-audio" disabled={playing} onClick={() => onPlay('AUDIO')}>
          Play
        </button>
        {hasVideo && (
          <button className="btn btn-video" disabled={playing} onClick={() => onPlay('VIDEO')}>
            Video
          </button>
        )}
        <div className="overflow-menu">
          <details>
            <summary>⋯</summary>
            <div className="overflow-panel">
              {onPlayNext && (
                <button className="btn btn-ghost" onClick={() => onPlayNext('AUDIO')}>
                  Play next
                </button>
              )}
              {onQueue && (
                <button className="btn btn-ghost" onClick={() => onQueue('AUDIO')}>
                  Add to queue
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => onDownload('AUDIO')}>
                Save MP3
              </button>
              {hasVideo && (
                <button className="btn btn-ghost" onClick={() => onDownload('VIDEO')}>
                  Save MP4
                </button>
              )}
              {onFavorite && (
                <button className="btn btn-ghost" onClick={() => onFavorite('AUDIO')}>
                  {favAudio ? 'Unlike' : 'Like'} audio
                </button>
              )}
              {onFavorite && hasVideo && (
                <button className="btn btn-ghost" onClick={() => onFavorite('VIDEO')}>
                  {favVideo ? 'Unlike' : 'Like'} video
                </button>
              )}
              {onPlaylist && (
                <button className="btn btn-ghost" onClick={onPlaylist}>
                  Add to playlist
                </button>
              )}
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}
