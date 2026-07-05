import type {MediaSearchResult} from '../types/media';
import {formatDuration} from '../utils/format';

interface Props {
  item: MediaSearchResult;
  playing?: boolean;
  onPlay: (type: 'AUDIO' | 'VIDEO') => void;
  onDownload: (type: 'AUDIO' | 'VIDEO') => void;
  onFavorite?: (type: 'AUDIO' | 'VIDEO') => void;
  onPlaylist?: () => void;
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
  favAudio,
  favVideo,
}: Props) {
  return (
    <article className="card">
      <img src={item.thumbnailUrl} alt={item.title} loading="lazy" />
      <div className="card-body">
        <div className="card-title">{item.title}</div>
        <div className="card-sub">
          {item.channel}
          {item.durationSeconds ? ` · ${formatDuration(item.durationSeconds)}` : ''}
        </div>
      </div>
      <div className="card-actions">
        <button className="btn btn-audio" disabled={playing} onClick={() => onPlay('AUDIO')}>
          ▶ Audio
        </button>
        <button className="btn btn-video" disabled={playing} onClick={() => onPlay('VIDEO')}>
          ▶ Video
        </button>
      </div>
      <div className="card-actions">
        <button className="btn btn-ghost" onClick={() => onDownload('AUDIO')}>
          ⬇ MP3
        </button>
        <button className="btn btn-ghost" onClick={() => onDownload('VIDEO')}>
          ⬇ MP4
        </button>
        {onFavorite && (
          <>
            <button className="btn btn-ghost" onClick={() => onFavorite('AUDIO')} title="Favorite audio">
              {favAudio ? '❤️' : '🤍'}
            </button>
            <button className="btn btn-ghost" onClick={() => onFavorite('VIDEO')} title="Favorite video">
              {favVideo ? '❤️' : '🤍'}
            </button>
            <button className="btn btn-ghost" onClick={onPlaylist} title="Add to playlist">
              ➕
            </button>
          </>
        )}
      </div>
    </article>
  );
}
