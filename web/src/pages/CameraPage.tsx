import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {api, resolveUrl} from '../api/client';
import {GeoMap} from '../components/GeoMap';
import type {CaptureItem} from '../types/media';
import {reverseGeocode} from '../utils/geocode';

type Mode = 'gallery' | 'map' | 'camera';

export function CameraPage() {
  const [mode, setMode] = useState<Mode>('gallery');
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [loc, setLoc] = useState<{lat: number; lng: number; accuracy?: number} | null>(null);
  const [locLabel, setLocLabel] = useState('');
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
        p => {
          setLoc({lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy});
          void reverseGeocode(p.coords.latitude, p.coords.longitude).then(g => setLocLabel(g.shortLabel));
        },
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

  const mapPoints = useMemo(
    () =>
      captures
        .filter(c => c.latitude != null && c.longitude != null)
        .map(c => ({
          id: c.id,
          latitude: c.latitude!,
          longitude: c.longitude!,
          title: c.locationLabel || c.fileName,
          subtitle: c.capturedAt ? new Date(c.capturedAt).toLocaleString() : c.type,
          color: c.type === 'VIDEO' ? '#FF6B9D' : '#FF9900',
        })),
    [captures],
  );

  const upload = async (blob: Blob, type: 'PHOTO' | 'VIDEO', fileName: string, durationMs?: number) => {
    setStatus('Uploading…');
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('type', type);
    form.append('clientCapturedAt', new Date().toISOString());
    if (loc) {
      form.append('latitude', String(loc.lat));
      form.append('longitude', String(loc.lng));
      if (loc.accuracy != null) form.append('gpsAccuracy', String(loc.accuracy));
      const geo = await reverseGeocode(loc.lat, loc.lng);
      if (geo.address) form.append('address', geo.address);
      if (geo.city) form.append('city', geo.city);
      if (geo.country) form.append('country', geo.country);
    }
    if (durationMs) form.append('durationMs', String(durationMs));
    try {
      await api.uploadCapture(form);
      setStatus('Saved to cloud — face trace scan running automatically');
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

  const openMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  return (
    <div className="page">
      <Link to="/" className="btn btn-ghost" style={{marginBottom: 12}}>
        ← Home
      </Link>
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Geo Camera</h1>

      <div className="tabs">
        <button className={`tab ${mode === 'gallery' ? 'active' : ''}`} onClick={() => setMode('gallery')}>
          Gallery
        </button>
        <button className={`tab ${mode === 'map' ? 'active' : ''}`} onClick={() => setMode('map')}>
          Map
        </button>
        <button className={`tab ${mode === 'camera' ? 'active' : ''}`} onClick={() => setMode('camera')}>
          Capture
        </button>
      </div>

      {status && <p style={{color: 'var(--primary)', marginBottom: 12}}>{status}</p>}
      {loc && mode === 'camera' && (
        <p style={{fontSize: 12, color: 'var(--muted)', marginBottom: 8}}>
          GPS: {locLabel || `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`}
          {loc.accuracy != null ? ` · ±${Math.round(loc.accuracy)}m` : ''}
        </p>
      )}

      {mode === 'camera' ? (
        <div>
          <video ref={videoRef} playsInline muted style={{width: '100%', borderRadius: 12, background: '#000'}} />
          <div style={{display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap'}}>
            <button className="btn btn-primary" onClick={() => void snapPhoto()}>
              📷 Photo
            </button>
            <button className={`btn ${recording ? 'btn-video' : 'btn-ghost'}`} onClick={toggleRecord}>
              {recording ? '⏹ Stop' : '🎥 Record'}
            </button>
          </div>
        </div>
      ) : mode === 'map' ? (
        loading ? (
          <div className="spinner" style={{margin: '24px auto'}} />
        ) : mapPoints.length === 0 ? (
          <p className="empty">No geo-tagged captures yet.</p>
        ) : (
          <div>
            <GeoMap points={mapPoints} className="geo-map" />
            <div style={{display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap'}}>
              <a className="btn btn-ghost" href={resolveUrl('/api/captures/export?format=geojson')} download>
                Export GeoJSON
              </a>
              <a className="btn btn-ghost" href={resolveUrl('/api/captures/export?format=gpx')} download>
                Export GPX
              </a>
            </div>
          </div>
        )
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
                  {c.locationLabel || [c.city, c.country].filter(Boolean).join(', ') || 'No location'}
                </div>
                {c.scanStatus && (
                  <div className="card-sub" style={{fontSize: 11}}>
                    Face scan: {c.scanStatus}
                    {c.matchCount != null ? ` · ${c.matchCount} match(es)` : ''}
                  </div>
                )}
              </div>
              <div className="card-actions">
                {c.latitude != null && c.longitude != null ? (
                  <button className="btn btn-ghost" onClick={() => openMaps(c.latitude!, c.longitude!)}>
                    📍
                  </button>
                ) : null}
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
