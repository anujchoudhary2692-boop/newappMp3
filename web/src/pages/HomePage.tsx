import {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {api, resolveUrl} from '../api/client';
import {usePlayback} from '../context/PlaybackContext';
import {listFavorites} from '../stores/favorites';
import {listRecent} from '../stores/recent';
import {pullCloudLibrary} from '../stores/librarySync';
import type {MediaItem} from '../types/media';
import {formatBytes} from '../utils/format';
import {getAuthUser} from '../utils/auth';

const TRENDING = ['Bollywood hits', 'Lo-fi beats', 'Hindi songs', 'Punjabi music', 'Workout mix', 'Chill indie'];

export function HomePage() {
  const nav = useNavigate();
  const pb = usePlayback();
  const [audioLib, setAudioLib] = useState<MediaItem[]>([]);
  const [recent, setRecent] = useState(listRecent());
  const [favorites, setFavorites] = useState(listFavorites());
  const [loading, setLoading] = useState(true);
  const user = getAuthUser();

  useEffect(() => {
    void (async () => {
      await pullCloudLibrary();
      setRecent(listRecent());
      setFavorites(listFavorites());
    })();
    api.audioLibrary()
      .then(r => setAudioLib(r.data.slice(0, 12)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const playRecent = (entry: (typeof recent)[0]) => {
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
        quality: item.quality,
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
        <div className="brand-hero">
          <img src="/logo.png" alt="" className="brand-mark brand-mark--hero" width={72} height={72} />
          <h1>MediaFace</h1>
        </div>
        <p>
          {user
            ? `Welcome back, ${user.username} — your library syncs across devices.`
            : 'Search, stream, and save music. Sign in to sync playlists & favorites.'}
        </p>
        <form
          className="search-bar"
          onSubmit={e => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get('q')?.toString().trim();
            if (q) nav(`/search?q=${encodeURIComponent(q)}`);
          }}>
          <input name="q" placeholder="Search songs, artists, links…" />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <div className="chips">
          {TRENDING.map(q => (
            <Link key={q} to={`/search?q=${encodeURIComponent(q)}`} className="chip">
              {q}
            </Link>
          ))}
        </div>
      </div>

      <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8}}>
        <Link to="/favorites" className="btn btn-ghost">
          Favorites
        </Link>
        <Link to="/playlists" className="btn btn-ghost">
          Playlists
        </Link>
        <Link to="/faces" className="btn btn-ghost">
          People
        </Link>
        <Link to="/camera" className="btn btn-ghost">
          Geo Camera
        </Link>
        {!user && (
          <Link to="/login" className="btn btn-primary">
            Sign in
          </Link>
        )}
      </div>

      {recent.length > 0 && (
        <>
          <h2 className="section-title">Continue listening</h2>
          <div className="section-rail">
            {recent.slice(0, 10).map((r, i) => (
              <article key={i} className="card" style={{cursor: 'pointer'}} onClick={() => playRecent(r)}>
                {r.media.thumbnailUrl && <img src={r.media.thumbnailUrl} alt="" />}
                <div className="card-body">
                  <div className="card-title">{r.media.title}</div>
                  <div className="card-sub">{r.media.quality || r.media.type}</div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {favorites.length > 0 && (
        <>
          <h2 className="section-title">Liked</h2>
          <div className="section-rail">
            {favorites.slice(0, 10).map(f => (
              <article
                key={f.id}
                className="card"
                style={{cursor: 'pointer'}}
                onClick={() => nav(`/search?q=${encodeURIComponent(f.title)}`)}>
                {f.thumbnailUrl && <img src={f.thumbnailUrl} alt="" />}
                <div className="card-body">
                  <div className="card-title">{f.title}</div>
                  <div className="card-sub">{f.channel || f.type}</div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <h2 className="section-title">Recently saved</h2>
      {loading ? (
        <p className="empty">Loading…</p>
      ) : audioLib.length === 0 ? (
        <p className="empty">No downloads yet. Search and save tracks for offline.</p>
      ) : (
        <div className="section-rail">
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
