import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listFavorites} from '../stores/favorites';
import {pullCloudLibrary} from '../stores/librarySync';
import {startPlayback} from '../utils/playback';
import {usePlayback, type QueueTrack} from '../context/PlaybackContext';
import type {MediaSearchResult, PlayableMedia} from '../types/media';
import {defaultQuality} from '../types/quality';

export function FavoritesPage() {
  const [items, setItems] = useState(listFavorites());
  const [preparing, setPreparing] = useState(false);
  const pb = usePlayback();
  const nav = useNavigate();

  useEffect(() => {
    void pullCloudLibrary()
      .then(() => setItems(listFavorites()))
      .catch(() => setItems(listFavorites()));
  }, []);

  const toSearchItem = (fav: (typeof items)[0]): MediaSearchResult => ({
    videoId: fav.videoId,
    title: fav.title,
    thumbnailUrl: fav.thumbnailUrl,
    channel: fav.channel,
    sourceUrl: fav.sourceUrl,
  });

  const playFrom = async (startIdx: number) => {
    if (!items.length) return;
    const start = Math.min(Math.max(0, startIdx), items.length - 1);
    const fav = items[start];
    const partial: PlayableMedia = {
      title: fav.title,
      type: fav.type,
      streamUrl: '',
      thumbnailUrl: fav.thumbnailUrl,
      sourceUrl: fav.sourceUrl,
      videoId: fav.videoId,
      quality: defaultQuality(fav.type),
    };
    pb.beginPrepare(partial);
    nav('/player');
    setPreparing(true);
    try {
      const first = await startPlayback(toSearchItem(fav), fav.type, undefined, msg =>
        pb.setPrepareStatus(msg),
      );
      const firstTrack: QueueTrack = {
        id: `${fav.videoId}:${fav.type}`,
        media: first.media,
        streamUrl: first.streamUrl,
      };
      pb.playQueue([firstTrack], 0);

      const rest = [...items.slice(start + 1), ...items.slice(0, start)];
      for (const t of rest) {
        try {
          const prepared = await startPlayback(toSearchItem(t), t.type);
          pb.addToQueue({
            id: `${t.videoId}:${t.type}:${Date.now()}`,
            media: prepared.media,
            streamUrl: prepared.streamUrl,
          });
        } catch {
          // skip
        }
      }
    } catch (e) {
      pb.failPrepare(e instanceof Error ? e.message : 'Play failed');
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="page">
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap'}}>
        <h1 style={{fontSize: 24, fontWeight: 800, flex: 1, margin: 0}}>Favorites</h1>
        {items.length > 0 ? (
          <button className="btn btn-primary" disabled={preparing} onClick={() => void playFrom(0)}>
            {preparing ? 'Preparing…' : '▶ Play all'}
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="empty">Heart tracks from search to save them here.</p>
      ) : (
        <div className="grid">
          {items.map((f, i) => (
            <article key={f.id} className="card">
              <img src={f.thumbnailUrl} alt="" />
              <div className="card-body">
                <div className="card-title">{f.title}</div>
                <div className="card-sub">
                  {f.type} · {f.channel}
                </div>
              </div>
              <div className="card-actions">
                <button className="btn btn-primary" disabled={preparing} onClick={() => void playFrom(i)}>
                  ▶ Play
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
