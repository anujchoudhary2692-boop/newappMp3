import {useCallback, useEffect, useState} from 'react';
import {getApiBaseLabel} from '../config';
import {api} from '../api/client';
import type {MediaDiagnostics} from '../types/media';

const API_KEY = 'mediaface:apiKey';
const API_URL = 'mediaface:apiUrl';

export function SettingsPage() {
  const [health, setHealth] = useState<string>('checking…');
  const [media, setMedia] = useState<MediaDiagnostics | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);
  const [customUrl, setCustomUrl] = useState(localStorage.getItem(API_URL) || '');
  const [customKey, setCustomKey] = useState(localStorage.getItem(API_KEY) || '');

  const refresh = useCallback(async () => {
    setHealth('checking…');
    try {
      const h = await api.health();
      setHealth(h.data.status);
      setMedia(h.data.media ?? null);
      const f = await api.features();
      setFeatures(f.data);
    } catch (e) {
      setHealth(e instanceof Error ? e.message : 'Offline');
      setMedia(null);
      setFeatures(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveConnection = () => {
    if (customUrl.trim()) localStorage.setItem(API_URL, customUrl.trim());
    else localStorage.removeItem(API_URL);
    if (customKey.trim()) localStorage.setItem(API_KEY, customKey.trim());
    else localStorage.removeItem(API_KEY);
    window.location.reload();
  };

  const clearLocal = () => {
    if (!confirm('Clear favorites, playlists, history, and recent?')) return;
    ['mediaface:favorites', 'mediaface:playlists', 'mediaface:history', 'mediaface:recent'].forEach(k =>
      localStorage.removeItem(k),
    );
    alert('Local data cleared.');
  };

  const badge = (ok: boolean | string) => (
    <span className={`status-badge ${ok === 'UP' || ok === true ? 'status-up' : 'status-down'}`}>
      {String(ok)}
    </span>
  );

  return (
    <div className="page">
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Settings</h1>

      <section style={{marginBottom: 24}}>
        <h2 className="section-title">Cloud server</h2>
        <div style={{background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16}}>
          <p style={{marginBottom: 8}}>
            Status {badge(health)}
          </p>
          <p style={{fontSize: 13, color: 'var(--muted)', marginBottom: 12}}>
            API: {getApiBaseLabel()}
          </p>
          {media && (
            <ul style={{fontSize: 13, color: 'var(--text2)', listStyle: 'none', display: 'grid', gap: 6}}>
              <li>yt-dlp: {media.ytDlp} {media.ytDlpVersion ? `(${media.ytDlpVersion})` : ''}</li>
              <li>ffmpeg: {media.ffmpeg}</li>
              <li>YouTube cookies: {media.youtubeCookies}</li>
              <li>Play / download: {media.playDownload}</li>
            </ul>
          )}
          <button className="btn btn-primary" style={{marginTop: 12}} onClick={() => void refresh()}>
            Refresh status
          </button>
        </div>
      </section>

      {features && (
        <section style={{marginBottom: 24}}>
          <h2 className="section-title">Features</h2>
          <div style={{display: 'grid', gap: 8}}>
            {Object.entries(features).map(([k, v]) => (
              <div key={k} style={{display: 'flex', justifyContent: 'space-between', fontSize: 14}}>
                <span>{k}</span>
                {badge(v ? 'UP' : 'DOWN')}
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{marginBottom: 24}}>
        <h2 className="section-title">Connection override</h2>
        <p style={{fontSize: 13, color: 'var(--muted)', marginBottom: 12}}>
          Point at a different backend (local or cloud). Page reloads after save.
        </p>
        <input
          value={customUrl}
          onChange={e => setCustomUrl(e.target.value)}
          placeholder="https://newappmp3.onrender.com"
          style={{width: '100%', marginBottom: 8, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)'}}
        />
        <input
          value={customKey}
          onChange={e => setCustomKey(e.target.value)}
          placeholder="API key (optional)"
          style={{width: '100%', marginBottom: 8, padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)'}}
        />
        <button className="btn btn-primary" onClick={saveConnection}>
          Save & reload
        </button>
      </section>

      <section>
        <h2 className="section-title">Local data</h2>
        <button className="btn btn-ghost" onClick={clearLocal}>
          Clear favorites & playlists
        </button>
      </section>
    </div>
  );
}
