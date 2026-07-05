import {useEffect, useState} from 'react';
import {NavLink, Outlet, useNavigate} from 'react-router-dom';
import {wakeServer} from '../api/client';
import {usePlayback} from '../context/PlaybackContext';

function MiniPlayer() {
  const pb = usePlayback();
  const nav = useNavigate();
  if (!pb.media || !pb.streamUrl) return null;
  return (
    <div className="mini-player" onClick={() => nav('/player')}>
      {pb.media.thumbnailUrl ? (
        <img src={pb.media.thumbnailUrl} alt="" />
      ) : (
        <div style={{width: 48, height: 48, background: '#333', borderRadius: 8}} />
      )}
      <div className="mini-info">
        <div className="mini-title">{pb.media.title}</div>
        <div className="mini-sub">
          {pb.buffering ? 'Buffering…' : pb.paused ? 'Paused' : 'Playing'}
        </div>
      </div>
      <button
        className="btn btn-ghost"
        onClick={e => {
          e.stopPropagation();
          pb.togglePause();
        }}>
        {pb.paused ? '▶' : '⏸'}
      </button>
    </div>
  );
}

export function Layout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    wakeServer(180000)
      .then(ok => {
        if (ok) setReady(true);
        else setError('Cloud server did not respond. Try again in a minute.');
      })
      .catch(() => setError('Cannot reach cloud server.'));
  }, []);

  if (!ready) {
    return (
      <div className="gate-screen">
        {error ? (
          <>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="spinner" />
            <p>Waking cloud server… first load can take up to 3 minutes.</p>
          </>
        )}
      </div>
    );
  }

  const link = ({isActive}: {isActive: boolean}) => (isActive ? 'nav-item active' : 'nav-item');

  return (
    <>
      <div className="app-shell">
        <Outlet />
      </div>
      <MiniPlayer />
      <nav className="bottom-nav">
        <NavLink to="/" end className={link}>
          <span>🏠</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/search" className={link}>
          <span>🔍</span>
          <span>Browse</span>
        </NavLink>
        <NavLink to="/library" className={link}>
          <span>📚</span>
          <span>Library</span>
        </NavLink>
        <NavLink to="/playlists" className={link}>
          <span>📋</span>
          <span>Lists</span>
        </NavLink>
        <NavLink to="/settings" className={link}>
          <span>⚙️</span>
          <span>Settings</span>
        </NavLink>
      </nav>
    </>
  );
}
