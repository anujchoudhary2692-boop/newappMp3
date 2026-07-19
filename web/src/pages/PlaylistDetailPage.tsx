import {useParams} from 'react-router-dom';
import {useNavigate} from 'react-router-dom';
import {getPlaylist, removeFromPlaylist, reorderPlaylist} from '../stores/playlists';
import {usePlayback, type QueueTrack} from '../context/PlaybackContext';
import {startPlayback} from '../utils/playback';
import type {MediaSearchResult, PlayableMedia} from '../types/media';
import {useState} from 'react';
import {defaultQuality} from '../types/quality';

export function PlaylistDetailPage() {
  const {id} = useParams<{id: string}>();
  const [rev, setRev] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const pl = id ? getPlaylist(id) : null;
  const pb = usePlayback();
  const nav = useNavigate();

  if (!pl) return <div className="page empty">Playlist not found</div>;

  const toSearchItem = (t: (typeof pl.items)[0]): MediaSearchResult => ({
    videoId: t.videoId || '',
    title: t.title,
    thumbnailUrl: t.thumbnailUrl || '',
    channel: '',
    sourceUrl: t.sourceUrl || '',
  });

  const playFrom = async (startIdx: number) => {
    const playable = pl.items.filter(t => t.videoId && t.sourceUrl);
    if (!playable.length) return;
    const start = Math.min(Math.max(0, startIdx), playable.length - 1);
    const firstItem = playable[start];
    const partial: PlayableMedia = {
      title: firstItem.title,
      type: firstItem.type,
      streamUrl: '',
      thumbnailUrl: firstItem.thumbnailUrl,
      sourceUrl: firstItem.sourceUrl,
      videoId: firstItem.videoId,
      quality: defaultQuality(firstItem.type),
    };
    pb.beginPrepare(partial);
    nav('/player');
    setPreparing(true);
    try {
      const first = await startPlayback(toSearchItem(firstItem), firstItem.type, undefined, msg =>
        pb.setPrepareStatus(msg),
      );
      const firstTrack: QueueTrack = {
        id: `${firstItem.videoId}:${firstItem.type}`,
        media: first.media,
        streamUrl: first.streamUrl,
      };
      pb.playQueue([firstTrack], 0);

      // Prepare remaining tracks in order and append to queue for continuous play
      const rest = [...playable.slice(start + 1), ...playable.slice(0, start)];
      for (const t of rest) {
        try {
          const prepared = await startPlayback(toSearchItem(t), t.type);
          pb.addToQueue({
            id: `${t.videoId}:${t.type}:${Date.now()}`,
            media: prepared.media,
            streamUrl: prepared.streamUrl,
          });
        } catch {
          // skip failed tracks
        }
      }
    } catch (e) {
      pb.failPrepare(e instanceof Error ? e.message : 'Play failed');
    } finally {
      setPreparing(false);
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
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap'}}>
        <h1 style={{fontSize: 24, fontWeight: 800, flex: 1, margin: 0}}>{pl.name}</h1>
        {pl.items.length > 0 ? (
          <button className="btn btn-primary" disabled={preparing} onClick={() => void playFrom(0)}>
            {preparing ? 'Preparing…' : '▶ Play all'}
          </button>
        ) : null}
      </div>
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
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                {t.title}
              </div>
              <div style={{fontSize: 12, color: 'var(--muted)'}}>{t.type}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => move(i, -1)}>
              ↑
            </button>
            <button className="btn btn-ghost" onClick={() => move(i, 1)}>
              ↓
            </button>
            <button className="btn btn-primary" disabled={preparing} onClick={() => void playFrom(i)}>
              ▶
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                removeFromPlaylist(pl.id, t.id);
                setRev(v => v + 1);
              }}>
              🗑
            </button>
          </div>
        ))
      )}
    </div>
  );
}
