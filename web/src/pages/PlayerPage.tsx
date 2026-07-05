import {Link, Navigate} from 'react-router-dom';
import {RATES, usePlayback} from '../context/PlaybackContext';

export function PlayerPage() {
  const pb = usePlayback();

  if (!pb.media) {
    return <Navigate to="/" replace />;
  }

  const preparing = !pb.streamUrl;

  const pct = pb.duration > 0 ? (pb.currentTime / pb.duration) * 100 : 0;
  const isVideo = pb.media.type === 'VIDEO';

  return (
    <div className="page player-page">
      <Link to="/search" className="btn btn-ghost" style={{marginBottom: 16}}>
        ← Back
      </Link>

      {isVideo ? (
        <div className="player-video-stage" aria-hidden="true" />
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
        {preparing ? ` · ${pb.prepareStatus || 'Preparing…'}` : pb.buffering ? ' · Buffering…' : pb.paused ? ' · Paused' : ' · Playing'}
      </p>

      {preparing && (
        <div style={{margin: '16px 0'}}>
          <div className="spinner" style={{margin: '0 auto 12px'}} />
          <p style={{color: 'var(--muted)', fontSize: 13}}>{pb.prepareStatus || 'Preparing stream on cloud…'}</p>
        </div>
      )}

      {pb.error && (
        <p style={{color: 'var(--danger)', marginBottom: 12, fontSize: 14}}>{pb.error}</p>
      )}

      <input
        type="range"
        className="progress"
        min={0}
        max={pb.duration || 100}
        step={0.1}
        value={pb.currentTime}
        disabled={preparing}
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
        <button className="control-btn play" onClick={pb.togglePause} disabled={preparing}>
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

      {isVideo && (
        <p style={{fontSize: 12, color: 'var(--muted)', marginTop: 16}}>
          Use the video controls above the title for fullscreen. SoundCloud tracks are often audio-only.
        </p>
      )}

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
