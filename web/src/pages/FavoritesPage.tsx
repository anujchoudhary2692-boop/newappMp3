import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listFavorites} from '../stores/favorites';
import {startPlayback} from '../utils/playback';
import {usePlayback} from '../context/PlaybackContext';
import type {MediaSearchResult} from '../types/media';

export function FavoritesPage() {
  const [items] = useState(listFavorites());
  const pb = usePlayback();
  const nav = useNavigate();

  const play = async (fav: (typeof items)[0]) => {
    const item: MediaSearchResult = {
      videoId: fav.videoId,
      title: fav.title,
      thumbnailUrl: fav.thumbnailUrl,
      channel: fav.channel,
      sourceUrl: fav.sourceUrl,
    };
    try {
      const {media, streamUrl} = await startPlayback(item, fav.type);
      pb.play(media, streamUrl);
      nav('/player');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Play failed');
    }
  };

  return (
    <div className="page">
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Favorites</h1>
      {items.length === 0 ? (
        <p className="empty">Heart tracks from search to save them here.</p>
      ) : (
        <div className="grid">
          {items.map(f => (
            <article key={f.id} className="card">
              <img src={f.thumbnailUrl} alt="" />
              <div className="card-body">
                <div className="card-title">{f.title}</div>
                <div className="card-sub">{f.type} · {f.channel}</div>
              </div>
              <div className="card-actions">
                <button className="btn btn-primary" onClick={() => play(f)}>▶ Play</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
