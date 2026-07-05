import {useCallback, useEffect, useState} from 'react';
import {useNavigate, useSearchParams} from 'react-router-dom';
import {api} from '../api/client';
import {MediaCard} from '../components/MediaCard';
import {QualityModal} from '../components/QualityModal';
import {usePlayback} from '../context/PlaybackContext';
import {addHistory, listHistory, removeHistory} from '../stores/history';
import {isFavorite, toggleFavorite} from '../stores/favorites';
import {addToPlaylist, listPlaylists} from '../stores/playlists';
import type {MediaSearchResult} from '../types/media';
import type {MediaQuality} from '../types/quality';
import {downloadToBrowser, startPlayback} from '../utils/playback';

type Pending = {
  item: MediaSearchResult;
  type: 'AUDIO' | 'VIDEO';
  action: 'play' | 'download';
};

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const pb = usePlayback();
  const [query, setQuery] = useState(params.get('q') || '');
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState(listHistory());
  const [favRev, setFavRev] = useState(0);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.search(trimmed);
      setResults(res.data);
      addHistory(trimmed);
      setHistory(listHistory());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = params.get('q');
    if (q) {
      setQuery(q);
      void search(q);
    }
  }, [params, search]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({q: query.trim()});
    void search(query);
  };

  const pasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const m = text.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
      if (m) {
        setQuery(m[1]);
        setParams({q: m[1]});
        void search(m[1]);
      }
    } catch {
      setError('Could not read clipboard');
    }
  };

  const handlePick = async (quality: MediaQuality) => {
    if (!pending) return;
    const {item, type, action} = pending;
    setPending(null);
    const key = `${item.videoId}:${type}`;
    setBusy(key);
    setStatus('');
    try {
      if (action === 'play') {
        const {media, streamUrl} = await startPlayback(item, type, quality, setStatus);
        pb.play(media, streamUrl);
        nav('/player');
      } else {
        await downloadToBrowser(item, type, quality, setStatus);
        alert('Download started — check your Downloads folder.');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
      setStatus('');
    }
  };

  const addPlaylist = (item: MediaSearchResult) => {
    const pls = listPlaylists();
    if (!pls.length) {
      alert('Create a playlist first in the Lists tab.');
      return;
    }
    addToPlaylist(pls[0].id, {
      title: item.title,
      type: 'AUDIO',
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl,
      videoId: item.videoId,
    });
    alert(`Added to "${pls[0].name}"`);
  };

  return (
    <div className="page">
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Browse</h1>
      <form className="search-bar" onSubmit={submit}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search songs, artists, videos…"
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          Search
        </button>
        <button type="button" className="btn btn-ghost" onClick={pasteLink}>
          Paste link
        </button>
      </form>

      {history.length > 0 && !results.length && (
        <div className="chips">
          {history.map(h => (
            <span key={h} className="chip" onClick={() => { setQuery(h); setParams({q: h}); void search(h); }}>
              {h}
              <button
                style={{marginLeft: 6, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer'}}
                onClick={e => { e.stopPropagation(); removeHistory(h); setHistory(listHistory()); }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {status && <p style={{color: 'var(--primary)', marginBottom: 12}}>{status}</p>}
      {error && <p style={{color: 'var(--danger)', marginBottom: 12}}>{error}</p>}
      {loading && <div className="spinner" style={{margin: '24px auto'}} />}

      <div className="grid" key={favRev}>
        {results.map(item => (
          <MediaCard
            key={item.videoId}
            item={item}
            playing={busy?.startsWith(item.videoId) ?? false}
            favAudio={isFavorite(item.videoId, 'AUDIO')}
            favVideo={isFavorite(item.videoId, 'VIDEO')}
            onPlay={type => setPending({item, type, action: 'play'})}
            onDownload={type => setPending({item, type, action: 'download'})}
            onFavorite={type => { toggleFavorite(item, type); setFavRev(v => v + 1); }}
            onPlaylist={() => addPlaylist(item)}
          />
        ))}
      </div>

      {pending && (
        <QualityModal
          type={pending.type}
          action={pending.action}
          onPick={handlePick}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
