import {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {api, resolveUrl} from '../api/client';
import type {CaptureItem} from '../types/media';

type Mode = 'gallery' | 'camera';

export function CameraPage() {
  const [mode, setMode] = useState<Mode>('gallery');
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [loc, setLoc] = useState<{lat: number; lng: number} | null>(null);
  const [status, setStatus] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listCaptures();
      setCaptures(res.data);
    } catch {
      setCaptures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'camera') {
      stream?.getTracks().forEach(t => t.stop());
      setStream(null);
      return;
    }
    let active = true;
    navigator.mediaDevices
      .getUserMedia({video: {facingMode: 'environment'}, audio: true})
      .then(s => {
        if (!active) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
      })
      .catch(() => setStatus('Camera permission denied'));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => setLoc({lat: p.coords.latitude, lng: p.coords.longitude}),
        () => undefined,
        {enableHighAccuracy: true, timeout: 10000},
      );
    }

    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [stream]);

  const upload = async (blob: Blob, type: 'PHOTO' | 'VIDEO', fileName: string, durationMs?: number) => {
    setStatus('Uploading…');
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('type', type);
    if (loc) {
      form.append('latitude', String(loc.lat));
      form.append('longitude', String(loc.lng));
    }
    if (durationMs) form.append('durationMs', String(durationMs));
    try {
      await api.uploadCapture(form);
      setStatus('Saved to cloud');
      setMode('gallery');
      void load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const snapPhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      blob => {
        if (blob) void upload(blob, 'PHOTO', `photo_${Date.now()}.jpg`);
      },
      'image/jpeg',
      0.92,
    );
  };

  const toggleRecord = () => {
    if (!stream) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, {mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined});
    recorderRef.current = rec;
    const started = Date.now();
    rec.ondataavailable = e => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, {type: rec.mimeType});
      void upload(blob, 'VIDEO', `video_${Date.now()}.webm`, Date.now() - started);
    };
    rec.start();
    setRecording(true);
  };

  const del = async (id: string) => {
    if (!confirm('Delete capture?')) return;
    await api.deleteCapture(id);
    void load();
  };

  return (
    <div className="page">
      <Link to="/" className="btn btn-ghost" style={{marginBottom: 12}}>
        ← Home
      </Link>
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Camera</h1>

      <div className="tabs">
        <button className={`tab ${mode === 'gallery' ? 'active' : ''}`} onClick={() => setMode('gallery')}>
          Gallery
        </button>
        <button className={`tab ${mode === 'camera' ? 'active' : ''}`} onClick={() => setMode('camera')}>
          Capture
        </button>
      </div>

      {status && <p style={{color: 'var(--primary)', marginBottom: 12}}>{status}</p>}
      {loc && mode === 'camera' && (
        <p style={{fontSize: 12, color: 'var(--muted)', marginBottom: 8}}>
          GPS: {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
        </p>
      )}

      {mode === 'camera' ? (
        <div>
          <video ref={videoRef} playsInline muted style={{width: '100%', borderRadius: 12, background: '#000'}} />
          <div style={{display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center'}}>
            <button className="btn btn-primary" onClick={() => void snapPhoto()}>
              📷 Photo
            </button>
            <button className={`btn ${recording ? 'btn-video' : 'btn-ghost'}`} onClick={toggleRecord}>
              {recording ? '⏹ Stop' : '🎥 Record'}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="spinner" style={{margin: '24px auto'}} />
      ) : captures.length === 0 ? (
        <p className="empty">No captures yet. Take a photo or video.</p>
      ) : (
        <div className="grid">
          {captures.map(c => (
            <article key={c.id} className="card">
              {c.type === 'PHOTO' ? (
                <img src={api.captureFileUrl(c.id)} alt="" loading="lazy" />
              ) : (
                <video src={api.captureFileUrl(c.id)} controls style={{width: '100%', aspectRatio: '16/9'}} />
              )}
              <div className="card-body">
                <div className="card-title">{c.fileName}</div>
                <div className="card-sub">
                  {[c.city, c.country].filter(Boolean).join(', ') || 'No location'}
                </div>
              </div>
              <div className="card-actions">
                <a className="btn btn-ghost" href={resolveUrl(`/api/captures/${c.id}/file`)} download={c.fileName}>
                  ⬇
                </a>
                <button className="btn btn-ghost" onClick={() => void del(c.id)}>
                  🗑
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
