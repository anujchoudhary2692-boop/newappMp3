import {useEffect, useRef} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {RATES, usePlayback} from '../context/PlaybackContext';

export function PlayerPage() {
  const pb = usePlayback();
  const nav = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (!pb.media || !pb.streamUrl) {
      nav('/', {replace: true});
      return;
    }
    const el = pb.media.type === 'VIDEO' ? pb.videoRef.current : pb.audioRef.current;
    if (el && !started.current) {
      started.current = true;
      void el.play().catch(() => undefined);
    }
  }, [pb.media, pb.streamUrl, nav, pb.videoRef, pb.audioRef]);

  if (!pb.media || !pb.streamUrl) return null;

  const pct = pb.duration > 0 ? (pb.currentTime / pb.duration) * 100 : 0;

  return (
    <div className="player-page">
      <Link to="/" className="btn btn-ghost" style={{float: 'left', marginBottom: 16}}>
        ← Back
      </Link>

      {pb.media.type === 'VIDEO' ? (
        <video
          ref={pb.videoRef}
          className="player-video"
          src={pb.streamUrl}
          poster={pb.media.thumbnailUrl}
          playsInline
          controls={false}
          onTimeUpdate={pb.onTimeUpdate}
          onLoadedMetadata={pb.onLoaded}
          onEnded={pb.onEnded}
          onWaiting={pb.onWaiting}
          onPlaying={pb.onPlaying}
        />
      ) : (
        <img
          className="player-art"
          src={pb.media.thumbnailUrl || ''}
          alt=""
          onError={e => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      <h1 style={{fontSize: 20, fontWeight: 800, marginBottom: 4}}>{pb.media.title}</h1>
      <p style={{color: 'var(--muted)', fontSize: 14, marginBottom: 8}}>
        {pb.media.type}
        {pb.media.quality ? ` · ${pb.media.quality}` : ''}
        {pb.buffering ? ' · Buffering…' : ''}
      </p>

      <input
        type="range"
        className="progress"
        min={0}
        max={pb.duration || 100}
        value={pb.currentTime}
        onChange={e => pb.seek(Number(e.target.value))}
        style={{background: `linear-gradient(to right, var(--primary) ${pct}%, var(--surface2) ${pct}%)`}}
      />
      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)'}}>
        <span>{pb.formatCurrent}</span>
        <span>{pb.formatDuration}</span>
      </div>

      <div className="controls">
        <button className="control-btn" onClick={pb.toggleShuffle} title="Shuffle">
          {pb.shuffle ? '🔀' : '↔'}
        </button>
        <button className="control-btn" onClick={pb.prev} title="Previous">
          ⏮
        </button>
        <button className="control-btn play" onClick={pb.togglePause}>
          {pb.paused ? '▶' : '⏸'}
        </button>
        <button className="control-btn" onClick={pb.next} title="Next">
          ⏭
        </button>
        <button className="control-btn" onClick={pb.toggleRepeat} title="Repeat">
          {pb.repeat ? '🔁' : '↻'}
        </button>
      </div>

      <div style={{display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 16}}>
        {RATES.map(r => (
          <button
            key={r}
            className={`btn ${pb.playbackRate === r ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => pb.setRate(r)}>
            {r}×
          </button>
        ))}
      </div>

      {pb.queue.length > 1 && (
        <div style={{marginTop: 24, textAlign: 'left'}}>
          <h3 style={{fontSize: 14, marginBottom: 8}}>Queue</h3>
          {pb.queue.map((t, i) => (
            <div
              key={t.id}
              style={{
                padding: 8,
                borderRadius: 8,
                background: i === pb.queueIndex ? 'var(--surface2)' : 'transparent',
                fontSize: 14,
              }}>
              {i + 1}. {t.media.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
