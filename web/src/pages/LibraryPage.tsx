import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api, resolveUrl} from '../api/client';
import {usePlayback} from '../context/PlaybackContext';
import type {MediaItem} from '../types/media';
import {formatBytes} from '../utils/format';

export function LibraryPage() {
  const [tab, setTab] = useState<'AUDIO' | 'VIDEO'>('AUDIO');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const pb = usePlayback();
  const nav = useNavigate();

  const load = () => {
    setLoading(true);
    const fn = tab === 'AUDIO' ? api.audioLibrary : api.videoLibrary;
    fn()
      .then(r => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);

  const play = (item: MediaItem) => {
    const url = resolveUrl(item.streamUrl);
    pb.play(
      {
        title: item.title,
        type: item.type,
        streamUrl: url,
        thumbnailUrl: item.thumbnailUrl,
        libraryId: item.id,
        sourceUrl: item.sourceUrl,
      },
      url,
    );
    nav('/player');
  };

  const del = async (id: string) => {
    if (!confirm('Delete from server library?')) return;
    await api.deleteMedia(id);
    load();
  };

  const download = (item: MediaItem) => {
    const a = document.createElement('a');
    a.href = resolveUrl(item.streamUrl);
    a.download = item.fileName;
    a.click();
  };

  return (
    <div className="page">
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Downloads</h1>
      <div className="tabs">
        <button className={`tab ${tab === 'AUDIO' ? 'active' : ''}`} onClick={() => setTab('AUDIO')}>
          Music
        </button>
        <button className={`tab ${tab === 'VIDEO' ? 'active' : ''}`} onClick={() => setTab('VIDEO')}>
          Videos
        </button>
      </div>
      {loading ? (
        <div className="spinner" style={{margin: '24px auto'}} />
      ) : items.length === 0 ? (
        <p className="empty">No {tab === 'AUDIO' ? 'music' : 'videos'} on server yet.</p>
      ) : (
        <div className="grid">
          {items.map(item => (
            <article key={item.id} className="card">
              <img src={item.thumbnailUrl} alt="" onClick={() => play(item)} style={{cursor: 'pointer'}} />
              <div className="card-body">
                <div className="card-title">{item.title}</div>
                <div className="card-sub">{formatBytes(item.fileSizeBytes)} · {item.quality}</div>
              </div>
              <div className="card-actions">
                <button className="btn btn-primary" onClick={() => play(item)}>▶ Play</button>
                <button className="btn btn-ghost" onClick={() => download(item)}>⬇ Save</button>
                <button className="btn btn-ghost" onClick={() => del(item.id)}>🗑</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
