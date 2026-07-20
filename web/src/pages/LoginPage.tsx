import {FormEvent, useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {api} from '../api/client';
import {setAuthSession} from '../utils/auth';
import {migrateLocalLibraryToCloud} from '../stores/librarySync';

export function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  useEffect(() => {
    void api
      .authStatus()
      .then(st => setAuthRequired(!!st.data.authRequired))
      .catch(() => setAuthRequired(false));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.login(username.trim(), password);
      setAuthSession(res.data.token, res.data.user);
      await migrateLocalLibraryToCloud();
      nav('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="MediaFace" className="brand-mark brand-mark--login" width={72} height={72} />
        <h1>MediaFace</h1>
        <p>
          {authRequired
            ? 'Sign in required to use this server.'
            : 'Sign in to sync playlists, favorites, and continue listening across devices.'}
        </p>
        {error && <p style={{color: 'var(--danger)', marginBottom: 12}}>{error}</p>}
        <label style={{display: 'block', fontSize: 13, marginBottom: 6}}>Username</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
          style={{
            width: '100%',
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text)',
          }}
        />
        <label style={{display: 'block', fontSize: 13, marginBottom: 6}}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          style={{
            width: '100%',
            marginBottom: 16,
            padding: 12,
            borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--text)',
          }}
        />
        <button className="btn btn-primary" style={{width: '100%'}} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {!authRequired ? (
          <p style={{marginTop: 16, fontSize: 13}}>
            <Link to="/">Continue as guest</Link> — library stays on this device only.
          </p>
        ) : null}
      </form>
    </div>
  );
}
