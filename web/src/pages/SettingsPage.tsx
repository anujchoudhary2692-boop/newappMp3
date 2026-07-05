import {useCallback, useEffect, useState} from 'react';
import {getApiBaseLabel} from '../config';
import {api} from '../api/client';
import type {MediaDiagnostics} from '../types/media';
import {
  isFaceAlertsEnabled,
  requestNotificationPermission,
  setFaceAlertsEnabled,
} from '../utils/faceAlerts';
import {clearAuthSession, getAuthUser, setAuthSession} from '../utils/auth';

const API_KEY = 'mediaface:apiKey';
const API_URL = 'mediaface:apiUrl';

export function SettingsPage() {
  const [health, setHealth] = useState<string>('checking…');
  const [media, setMedia] = useState<MediaDiagnostics | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);
  const [customUrl, setCustomUrl] = useState(localStorage.getItem(API_URL) || '');
  const [customKey, setCustomKey] = useState(localStorage.getItem(API_KEY) || '');
  const [alertsOn, setAlertsOn] = useState(isFaceAlertsEnabled());
  const [authRequired, setAuthRequired] = useState(false);
  const [authUser, setAuthUser] = useState(getAuthUser());
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const refresh = useCallback(async () => {
    setHealth('checking…');
    try {
      const auth = await api.authStatus();
      setAuthRequired(Boolean(auth.data.authRequired));
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

      <section style={{marginBottom: 24}}>
        <h2 className="section-title">Enterprise auth</h2>
        <p style={{fontSize: 13, color: 'var(--muted)', marginBottom: 8}}>
          {authRequired ? 'Login required for API access.' : 'Auth optional — enable REQUIRE_AUTH on server for roles.'}
        </p>
        {authUser ? (
          <div style={{fontSize: 14, marginBottom: 8}}>
            Signed in as <strong>{authUser.username}</strong> ({authUser.role})
            <button
              className="btn btn-ghost"
              style={{marginLeft: 8}}
              onClick={() => {
                clearAuthSession();
                setAuthUser(null);
              }}>
              Sign out
            </button>
          </div>
        ) : (
          <div style={{display: 'grid', gap: 8, maxWidth: 360}}>
            <input
              value={loginUser}
              onChange={e => setLoginUser(e.target.value)}
              placeholder="Username"
              style={{padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)'}}
            />
            <input
              type="password"
              value={loginPass}
              onChange={e => setLoginPass(e.target.value)}
              placeholder="Password"
              style={{padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)'}}
            />
            <button
              className="btn btn-primary"
              onClick={() => {
                void (async () => {
                  try {
                    const res = await api.login(loginUser, loginPass);
                    setAuthSession(res.data.token, res.data.user);
                    setAuthUser(res.data.user);
                    setLoginPass('');
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Login failed');
                  }
                })();
              }}>
              Sign in
            </button>
          </div>
        )}
        <p style={{fontSize: 12, color: 'var(--muted)', marginTop: 8}}>
          Roles: ADMIN (manage users), OPERATOR (register/scan), VIEWER (read-only). Set ADMIN_USERNAME + ADMIN_PASSWORD on Render to seed admin.
        </p>
      </section>

      <section style={{marginBottom: 24}}>
        <h2 className="section-title">Face tracing</h2>
        <label style={{display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, marginBottom: 8}}>
          <input
            type="checkbox"
            checked={alertsOn}
            onChange={e => {
              const on = e.target.checked;
              setAlertsOn(on);
              setFaceAlertsEnabled(on);
              if (on) void requestNotificationPermission();
            }}
          />
          Browser notifications when a registered person is sighted
        </label>
        <p style={{fontSize: 13, color: 'var(--muted)'}}>
          Server webhook: set FACE_ALERT_WEBHOOK_URL on Render for Slack/Discord alerts.
          Native push: set FCM_PROJECT_ID + FCM_SERVICE_ACCOUNT_JSON and register device tokens from mobile.
        </p>
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
