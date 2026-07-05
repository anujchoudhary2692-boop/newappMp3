import {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {api, resolveUrl} from '../api/client';
import {usePlayback} from '../context/PlaybackContext';
import {listRecent} from '../stores/recent';
import type {MediaItem} from '../types/media';
import {formatBytes} from '../utils/format';
const TRENDING = ['Bollywood hits', 'Lo-fi beats', 'Hindi songs', 'Punjabi music'];

export function HomePage() {
  const nav = useNavigate();
  const pb = usePlayback();
  const [audioLib, setAudioLib] = useState<MediaItem[]>([]);
  const [recent] = useState(listRecent());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.audioLibrary()
      .then(r => setAudioLib(r.data.slice(0, 8)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const playRecent = async (entry: (typeof recent)[0]) => {
    pb.play(entry.media, entry.streamUrl);
    nav('/player');
  };

  const playLibrary = (item: MediaItem) => {
    const url = resolveUrl(item.streamUrl);
    pb.play(
      {
        title: item.title,
        type: item.type,
        streamUrl: url,
        thumbnailUrl: item.thumbnailUrl,
        videoId: item.sourceUrl?.match(/v=([^&]+)/)?.[1],
        libraryId: item.id,
      },
      url,
    );
    nav('/player');
  };

  return (
    <div className="page">
      <div className="hero">
        <h1>MediaFace</h1>
        <p>Search, stream, and download music from SoundCloud & the open web.</p>
        <div className="search-bar">
          <Link to="/search" className="btn btn-primary" style={{flex: 1, textAlign: 'center'}}>
            🔍 Search YouTube
          </Link>
        </div>
        <div className="chips">
          {TRENDING.map(q => (
            <Link key={q} to={`/search?q=${encodeURIComponent(q)}`} className="chip">
              {q}
            </Link>
          ))}
        </div>
      </div>

      <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24}}>
        <Link to="/faces" className="btn btn-ghost">👤 Faces</Link>
        <Link to="/camera" className="btn btn-ghost">📷 Camera</Link>
        <Link to="/favorites" className="btn btn-ghost">❤️ Favorites</Link>
      </div>

      {recent.length > 0 && (
        <>
          <h2 className="section-title">Recently played</h2>
          <div className="grid">
            {recent.slice(0, 6).map((r, i) => (
              <article key={i} className="card" style={{cursor: 'pointer'}} onClick={() => playRecent(r)}>
                {r.media.thumbnailUrl && <img src={r.media.thumbnailUrl} alt="" />}
                <div className="card-body">
                  <div className="card-title">{r.media.title}</div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Saved on server</h2>
      {loading ? (
        <p className="empty">Loading…</p>
      ) : audioLib.length === 0 ? (
        <p className="empty">No downloads yet. Search and download tracks.</p>
      ) : (
        <div className="grid">
          {audioLib.map(item => (
            <article key={item.id} className="card" style={{cursor: 'pointer'}} onClick={() => playLibrary(item)}>
              <img src={item.thumbnailUrl} alt="" />
              <div className="card-body">
                <div className="card-title">{item.title}</div>
                <div className="card-sub">{formatBytes(item.fileSizeBytes)}</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
