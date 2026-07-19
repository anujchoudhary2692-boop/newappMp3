import {useCallback, useEffect, useMemo, useState} from 'react';
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
import {defaultQuality} from '../types/quality';
import {downloadToBrowser, startPlayback} from '../utils/playback';
import type {PlayableMedia} from '../types/media';

type Pending = {
  item: MediaSearchResult;
  type: 'AUDIO' | 'VIDEO';
  action: 'play' | 'download' | 'queue' | 'playNext';
};

type Tab = 'top' | 'songs' | 'videos';

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
  const [tab, setTab] = useState<Tab>('top');

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
      // Prefetch prepare for top result (instant-feel)
      const top = res.data[0];
      if (top?.videoId) {
        void api.prepare(top.videoId, 'AUDIO', defaultQuality('AUDIO'), top.sourceUrl).catch(() => undefined);
      }
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

  const filtered = useMemo(() => {
    if (tab === 'songs') {
      const audioOnly = results.filter(r => r.hasVideo === false);
      // Prefer catalog/audio hits; if search is YouTube-heavy, show all so Songs is usable.
      return audioOnly.length > 0 ? audioOnly : results;
    }
    if (tab === 'videos') return results.filter(r => r.hasVideo !== false);
    return results;
  }, [results, tab]);

  const topResult = tab === 'top' ? results[0] : null;
  const listResults = tab === 'top' ? results.slice(1) : filtered;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({q: query.trim()});
    void search(query);
  };

  const pasteLink = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return;
      const yt = text.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
      if (yt) {
        setQuery(yt[1]);
        setParams({q: yt[1]});
        void search(yt[1]);
        return;
      }
      if (/^https?:\/\//i.test(text)) {
        setStatus('Loading link…');
        const info = await api.streamInfo(text);
        const item: MediaSearchResult = {
          videoId: info.data.videoId,
          title: info.data.title,
          thumbnailUrl: '',
          channel: 'Direct link',
          sourceUrl: text,
          source: 'Web',
        };
        setResults([item]);
        setStatus('');
        return;
      }
      setQuery(text);
      setParams({q: text});
      void search(text);
    } catch {
      setError('Could not read clipboard or load link');
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
        const preset = quality || defaultQuality(type);
        const partial: PlayableMedia = {
          title: item.title,
          type,
          streamUrl: '',
          thumbnailUrl: item.thumbnailUrl,
          sourceUrl: item.sourceUrl,
          videoId: item.videoId,
          quality: preset,
        };
        pb.beginPrepare(partial);
        nav('/player');
        const {media, streamUrl} = await startPlayback(item, type, quality, msg => {
          pb.setPrepareStatus(msg);
        });
        pb.play(media, streamUrl);
      } else if (action === 'queue' || action === 'playNext') {
        const {media, streamUrl} = await startPlayback(item, type, quality, setStatus);
        const track = {
          id: `${media.videoId || media.title}:${type}:${Date.now()}`,
          media,
          streamUrl,
        };
        if (action === 'playNext') pb.playNextInsert(track);
        else pb.addToQueue(track);
        setStatus(action === 'playNext' ? 'Queued to play next' : 'Added to queue');
      } else {
        await downloadToBrowser(item, type, quality, setStatus);
        alert('Download started — check your Downloads folder.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      if (action === 'play') pb.failPrepare(msg);
      else setError(msg);
    } finally {
      setBusy(null);
      setStatus('');
    }
  };

  const addPlaylist = (item: MediaSearchResult) => {
    const pls = listPlaylists();
    if (!pls.length) {
      alert('Create a playlist first from Home → Playlists.');
      return;
    }
    addToPlaylist(pls[0].id, {
      title: item.title,
      type: 'AUDIO',
      thumbnailUrl: item.thumbnailUrl,
      sourceUrl: item.sourceUrl,
      videoId: item.videoId,
      channel: item.channel,
    });
    alert(`Added to "${pls[0].name}"`);
  };

  return (
    <div className="page">
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 8}}>Browse</h1>
      <p style={{color: 'var(--muted)', fontSize: 14, marginBottom: 16}}>
        SoundCloud & open web · tap a result to play, or use ⋯ for queue & downloads
      </p>
      <form className="search-bar" onSubmit={submit}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search songs, artists… (SoundCloud & web)"
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
            <span
              key={h}
              className="chip"
              onClick={() => {
                setQuery(h);
                setParams({q: h});
                void search(h);
              }}>
              {h}
              <button
                style={{marginLeft: 6, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer'}}
                onClick={e => {
                  e.stopPropagation();
                  removeHistory(h);
                  setHistory(listHistory());
                }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="search-tabs tabs">
          {(['top', 'songs', 'videos'] as Tab[]).map(t => (
            <button key={t} type="button" className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'top' ? 'Top' : t === 'songs' ? 'Songs' : 'Videos'}
            </button>
          ))}
        </div>
      )}

      {status && <p style={{color: 'var(--primary)', marginBottom: 12}}>{status}</p>}
      {error && <p style={{color: 'var(--danger)', marginBottom: 12}}>{error}</p>}
      {loading && <div className="spinner" style={{margin: '24px auto'}} />}

      {topResult && (
        <div className="hero-result">
          {topResult.thumbnailUrl ? <img src={topResult.thumbnailUrl} alt="" /> : <div />}
          <div>
            <div style={{fontSize: 12, color: 'var(--primary)', fontWeight: 700, marginBottom: 4}}>Top result</div>
            <div style={{fontSize: 20, fontWeight: 800, marginBottom: 4}}>{topResult.title}</div>
            <div style={{fontSize: 13, color: 'var(--muted)', marginBottom: 12}}>
              {topResult.channel}
              {topResult.source ? ` · ${topResult.source}` : ''}
            </div>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <button className="btn btn-audio" onClick={() => setPending({item: topResult, type: 'AUDIO', action: 'play'})}>
                Play audio
              </button>
              {topResult.hasVideo !== false && (
                <button className="btn btn-video" onClick={() => setPending({item: topResult, type: 'VIDEO', action: 'play'})}>
                  Play video
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => setPending({item: topResult, type: 'AUDIO', action: 'playNext'})}>
                Play next
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid" key={favRev}>
        {listResults.map(item => (
          <MediaCard
            key={item.videoId}
            item={item}
            playing={busy?.startsWith(item.videoId) ?? false}
            favAudio={isFavorite(item.videoId, 'AUDIO')}
            favVideo={isFavorite(item.videoId, 'VIDEO')}
            onPlay={type => setPending({item, type, action: 'play'})}
            onDownload={type => setPending({item, type, action: 'download'})}
            onQueue={type => setPending({item, type, action: 'queue'})}
            onPlayNext={type => setPending({item, type, action: 'playNext'})}
            onFavorite={type => {
              toggleFavorite(item, type);
              setFavRev(v => v + 1);
            }}
            onPlaylist={() => addPlaylist(item)}
            onPrefetch={() => {
              void api.prepare(item.videoId, 'AUDIO', defaultQuality('AUDIO'), item.sourceUrl).catch(() => undefined);
            }}
          />
        ))}
      </div>

      {pending && (
        <QualityModal
          type={pending.type}
          action={pending.action === 'download' ? 'download' : 'play'}
          onPick={handlePick}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}
