import {useEffect, useRef, useState} from 'react';
import {NavLink, Outlet, useNavigate} from 'react-router-dom';
import {wakeServer} from '../api/client';
import {usePlayback} from '../context/PlaybackContext';

function Icon({name}: {name: string}) {
  const paths: Record<string, string> = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z',
    search: 'M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm8.3 14.7-3.8-3.8',
    library: 'M4 4h4v16H4V4zm6 0h4v16h-4V4zm6 4h4v12h-4V8z',
    faces: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z',
    camera: 'M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8.5 3.5-.8-1.4 1.2-1.6-1.8-1.8-1.6 1.2-1.4-.8L15 5h-2.5l-.2 1.9-1.4.8-1.6-1.2-1.8 1.8 1.2 1.6-.8 1.4L5 12v2.5l1.9.2.8 1.4-1.2 1.6 1.8 1.8 1.6-1.2 1.4.8.2 1.9H15l.2-1.9 1.4-.8 1.6 1.2 1.8-1.8-1.2-1.6.8-1.4 1.9-.2V12h-1.5z',
  };
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.home} fill="currentColor" />
    </svg>
  );
}

function MiniPlayer() {
  const pb = usePlayback();
  const nav = useNavigate();
  const seekRef = useRef<HTMLInputElement>(null);
  if (!pb.media) return null;
  const pct = pb.duration > 0 ? (pb.currentTime / pb.duration) * 100 : 0;
  return (
    <div className="mini-player">
      <button type="button" className="mini-main" onClick={() => nav('/player')}>
        {pb.media.thumbnailUrl ? (
          <img src={pb.media.thumbnailUrl} alt="" />
        ) : (
          <div className="mini-art-fallback" />
        )}
        <div className="mini-info">
          <div className="mini-title">{pb.media.title}</div>
          <div className="mini-sub">
            {pb.media.quality || pb.media.type}
            {!pb.streamUrl
              ? ` · ${pb.prepareStatus || 'Preparing…'}`
              : pb.buffering
                ? ' · Buffering…'
                : pb.paused
                  ? ' · Paused'
                  : ' · Playing'}
          </div>
        </div>
      </button>
      <div className="mini-controls" onClick={e => e.stopPropagation()}>
        <button type="button" className="mini-btn" onClick={() => pb.prev()} title="Previous">
          ⏮
        </button>
        <button type="button" className="mini-btn mini-play" onClick={() => pb.togglePause()} title="Play/Pause">
          {pb.paused ? '▶' : '⏸'}
        </button>
        <button type="button" className="mini-btn" onClick={() => pb.next()} title="Next">
          ⏭
        </button>
      </div>
      <input
        ref={seekRef}
        type="range"
        className="mini-seek"
        min={0}
        max={pb.duration || 100}
        step={0.1}
        value={pb.currentTime}
        disabled={!pb.streamUrl}
        onClick={e => e.stopPropagation()}
        onChange={e => pb.seek(Number(e.target.value))}
        style={{background: `linear-gradient(to right, var(--primary) ${pct}%, var(--surface2) ${pct}%)`}}
      />
    </div>
  );
}

export function Layout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const pb = usePlayback();
  const nav = useNavigate();

  useEffect(() => {
    wakeServer(180000)
      .then(async ok => {
        if (!ok) {
          setError('Cloud server did not respond. Try again in a minute.');
          return;
        }
        try {
          const {api} = await import('../api/client');
          const {getAuthToken} = await import('../utils/auth');
          const st = await api.authStatus();
          if (st.data.authRequired && !getAuthToken()) {
            nav('/login', {replace: true});
          }
        } catch {
          // continue without auth gate
        }
        setReady(true);
      })
      .catch(() => setError('Cannot reach cloud server.'));
  }, [nav]);

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
      <div className={`app-shell${pb.media ? ' app-shell--with-mini' : ''}`}>
        <Outlet />
      </div>
      <MiniPlayer />
      <nav className="bottom-nav">
        <NavLink to="/" end className={link}>
          <Icon name="home" />
          <span>Home</span>
        </NavLink>
        <NavLink to="/search" className={link}>
          <Icon name="search" />
          <span>Browse</span>
        </NavLink>
        <NavLink to="/library" className={link}>
          <Icon name="library" />
          <span>Library</span>
        </NavLink>
        <NavLink to="/faces" className={link}>
          <Icon name="faces" />
          <span>Faces</span>
        </NavLink>
        <NavLink to="/camera" className={link}>
          <Icon name="camera" />
          <span>Camera</span>
        </NavLink>
        <NavLink to="/settings" className={link}>
          <Icon name="settings" />
          <span>Settings</span>
        </NavLink>
      </nav>
    </>
  );
}
