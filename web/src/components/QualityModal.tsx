import type {MediaQuality} from '../types/quality';
import {AUDIO_OPTIONS, VIDEO_OPTIONS} from '../types/quality';

interface Props {
  type: 'AUDIO' | 'VIDEO';
  action: 'play' | 'download';
  onPick: (q: MediaQuality) => void;
  onClose: () => void;
}

export function QualityModal({type, action, onPick, onClose}: Props) {
  const opts = type === 'AUDIO' ? AUDIO_OPTIONS : VIDEO_OPTIONS;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{action === 'play' ? 'Play' : 'Download'} quality — {type === 'AUDIO' ? 'Audio' : 'Video'}</h3>
        {opts.map(o => (
          <button key={o.id} className="quality-opt" onClick={() => onPick(o.id)}>
            <strong>{o.label}</strong>
            <small>{o.sub}</small>
          </button>
        ))}
        <button className="btn btn-ghost" style={{width: '100%', marginTop: 8}} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
