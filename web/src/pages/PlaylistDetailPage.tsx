import {useParams} from 'react-router-dom';
import {useNavigate} from 'react-router-dom';
import {getPlaylist, removeFromPlaylist, reorderPlaylist} from '../stores/playlists';
import {usePlayback} from '../context/PlaybackContext';
import {startPlayback} from '../utils/playback';
import type {MediaSearchResult} from '../types/media';
import {useState} from 'react';

export function PlaylistDetailPage() {
  const {id} = useParams<{id: string}>();
  const [rev, setRev] = useState(0);
  const pl = id ? getPlaylist(id) : null;
  const pb = usePlayback();
  const nav = useNavigate();

  if (!pl) return <div className="page empty">Playlist not found</div>;

  const playTrack = async (idx: number) => {
    const t = pl.items[idx];
    if (!t.videoId || !t.sourceUrl) return;
    const item: MediaSearchResult = {
      videoId: t.videoId,
      title: t.title,
      thumbnailUrl: t.thumbnailUrl || '',
      channel: '',
      sourceUrl: t.sourceUrl,
    };
    try {
      const {media, streamUrl} = await startPlayback(item, t.type);
      pb.play(media, streamUrl);
      nav('/player');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Play failed');
    }
  };

  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir;
    if (to < 0 || to >= pl.items.length) return;
    reorderPlaylist(pl.id, from, to);
    setRev(v => v + 1);
  };

  return (
    <div className="page" key={rev}>
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>{pl.name}</h1>
      {pl.items.length === 0 ? (
        <p className="empty">Empty playlist. Add tracks from Browse.</p>
      ) : (
        pl.items.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderBottom: '1px solid var(--border)',
            }}>
            {t.thumbnailUrl && <img src={t.thumbnailUrl} alt="" style={{width: 56, height: 56, borderRadius: 8}} />}
            <div style={{flex: 1}}>
              <div style={{fontWeight: 700}}>{t.title}</div>
              <div style={{fontSize: 12, color: 'var(--muted)'}}>{t.type}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => move(i, -1)}>↑</button>
            <button className="btn btn-ghost" onClick={() => move(i, 1)}>↓</button>
            <button className="btn btn-primary" onClick={() => playTrack(i)}>▶</button>
            <button
              className="btn btn-ghost"
              onClick={() => { removeFromPlaylist(pl.id, t.id); setRev(v => v + 1); }}>
              🗑
            </button>
          </div>
        ))
      )}
    </div>
  );
}
