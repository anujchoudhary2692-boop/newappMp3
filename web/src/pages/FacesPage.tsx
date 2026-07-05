import {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {api, resolveUrl} from '../api/client';
import type {Person, PersonTimelineEntry} from '../types/media';
import {
  downloadTraceExport,
  isFaceAlertsEnabled,
  notifyPersonSighted,
  requestNotificationPermission,
  setFaceAlertsEnabled,
} from '../utils/faceAlerts';

type Tab = 'people' | 'register' | 'identify' | 'alerts' | 'trace';

function dayLabel(iso?: string) {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'Unknown date'
    : d.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'});
}

function sourceLabel(entry: PersonTimelineEntry) {
  if (entry.sourceType === 'CAPTURE') return 'Camera photo';
  if (entry.sourceType === 'CAPTURE_VIDEO') return 'Camera video';
  if (entry.sourceType === 'MEDIA_VIDEO') return 'Streamed video';
  return entry.sourceType || 'Photo';
}

export function FacesPage() {
  const [tab, setTab] = useState<Tab>('people');
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState('');
  const [alerts, setAlerts] = useState<PersonTimelineEntry[]>([]);
  const [tracePerson, setTracePerson] = useState<Person | null>(null);
  const [timeline, setTimeline] = useState<PersonTimelineEntry[]>([]);
  const [liveActive, setLiveActive] = useState(false);
  const [liveResult, setLiveResult] = useState('');
  const [alertsOn, setAlertsOn] = useState(isFaceAlertsEnabled());
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const st = await api.faceStatus();
      setReady(st.data.ready ?? (st.data as {engineReady?: boolean}).engineReady ?? false);
      if (!st.data.ready && !(st.data as {engineReady?: boolean}).engineReady) {
        setMsg(st.data.message || 'Face AI unavailable on this server.');
        setPeople([]);
        return;
      }
      const res = await api.listFaces();
      setPeople(res.data);
      const alertRes = await api.recentFaceAlerts(30);
      setAlerts(alertRes.data);
      setMsg('');
    } catch (e) {
      setReady(false);
      setMsg(e instanceof Error ? e.message : 'Face AI unavailable');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (liveTimerRef.current) window.clearInterval(liveTimerRef.current);
    };
  }, []);

  const pickFile = (f: File | null) => {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const register = async () => {
    if (!file || !name.trim()) {
      alert('Name and photo required');
      return;
    }
    const form = new FormData();
    form.append('name', name.trim());
    form.append('notes', notes);
    form.append('image', file);
    try {
      const res = await api.registerFace(form);
      alert(`Registered ${res.data.name}`);
      setName('');
      setNotes('');
      pickFile(null);
      setTab('people');
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Register failed');
    }
  };

  const identify = async () => {
    if (!file) {
      alert('Choose a photo first');
      return;
    }
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await api.identifyFace(form);
      const d = res.data;
      if (d.matched && d.personName) {
        const conf = d.confidence ?? 0;
        const text = `${d.personName} (${Math.round(conf <= 1 ? conf * 100 : conf)}%)`;
        setResult(text);
        void notifyPersonSighted(d.personName, conf <= 1 ? conf * 100 : conf);
        alert(`Match found: ${text}`);
      } else if (d.personName) {
        setResult(`${d.personName} (${Math.round(d.confidence ?? 0)}%)`);
      } else {
        setResult('No match found');
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Identify failed');
    }
  };

  const openTrace = async (person: Person) => {
    setTracePerson(person);
    setTab('trace');
    try {
      const res = await api.personTimeline(person.id);
      setTimeline(res.data);
    } catch {
      setTimeline([]);
    }
  };

  const startLiveIdentify = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLiveActive(true);
      liveTimerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.videoWidth === 0) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        canvas.toBlob(async blob => {
          if (!blob) return;
          const form = new FormData();
          form.append('image', blob, 'live.jpg');
          try {
            const res = await api.identifyFace(form);
            if (res.data.matched && res.data.personName) {
              const conf = res.data.confidence ?? 0;
              const text = `${res.data.personName} · ${Math.round(conf)}%`;
              setLiveResult(text);
              void notifyPersonSighted(res.data.personName, conf);
            }
          } catch {
            // ignore
          }
        }, 'image/jpeg', 0.85);
      }, 3500);
    } catch {
      alert('Camera permission required for live identify');
    }
  };

  const stopLiveIdentify = () => {
    if (liveTimerRef.current) {
      window.clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
    if (video) video.srcObject = null;
    setLiveActive(false);
    setLiveResult('');
  };

  const del = async (id: string) => {
    if (!confirm('Delete this person?')) return;
    await api.deleteFace(id);
    void load();
  };

  const groupedTimeline = timeline.reduce<Record<string, PersonTimelineEntry[]>>((acc, entry) => {
    const key = dayLabel(entry.matchedAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="page">
      <Link to="/" className="btn btn-ghost" style={{marginBottom: 12}}>
        ← Home
      </Link>
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 8}}>Face tracing</h1>
      <p style={{color: 'var(--muted)', fontSize: 14, marginBottom: 16}}>
        Find people across camera, videos, and your database.
      </p>

      <div style={{display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap'}}>
        <label style={{display: 'flex', gap: 8, alignItems: 'center', fontSize: 14}}>
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
          Sighting alerts
        </label>
      </div>

      {ready === false && (
        <p style={{color: 'var(--danger)', marginBottom: 16}}>{msg || 'Face AI unavailable.'}</p>
      )}

      <div className="tabs">
        {(['people', 'register', 'identify', 'alerts', ...(tracePerson ? (['trace'] as Tab[]) : [])] as Tab[]).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'people' ? 'People' : t === 'register' ? 'Register' : t === 'identify' ? 'Identify' : t === 'alerts' ? 'Alerts' : 'Trace'}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="user"
        style={{display: 'none'}}
        onChange={e => pickFile(e.target.files?.[0] ?? null)}
      />

      {tab === 'people' && (
        <>
          {people.length === 0 ? (
            <p className="empty">No people registered yet.</p>
          ) : (
            people.map(p => (
              <div
                key={p.id}
                style={{display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid var(--border)'}}>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 700}}>{p.name}</div>
                  <div style={{fontSize: 12, color: 'var(--muted)'}}>
                    {p.photoCount ?? 0} sightings {p.notes ? `· ${p.notes}` : ''}
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => void openTrace(p)}>
                  Trace
                </button>
                <button className="btn btn-ghost" onClick={() => del(p.id)}>
                  🗑
                </button>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'register' && (
        <div style={{display: 'grid', gap: 12}}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Person name"
            style={{padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)'}}
          />
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            style={{padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)'}}
          />
          {preview && <img src={preview} alt="" style={{maxWidth: '100%', borderRadius: 12}} />}
          <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>📷 Choose photo</button>
          <button className="btn btn-primary" onClick={() => void register()}>Save face</button>
        </div>
      )}

      {tab === 'identify' && (
        <div style={{display: 'grid', gap: 12}}>
          {preview && <img src={preview} alt="" style={{maxWidth: '100%', borderRadius: 12}} />}
          <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>📷 Choose photo</button>
          <button className="btn btn-primary" onClick={() => void identify()}>Identify</button>
          {!liveActive ? (
            <button className="btn btn-video" onClick={() => void startLiveIdentify()}>🎥 Live camera identify</button>
          ) : (
            <>
              <video ref={videoRef} playsInline muted style={{width: '100%', borderRadius: 12, background: '#000'}} />
              {liveResult && <p style={{fontWeight: 700, color: 'var(--primary)'}}>{liveResult}</p>}
              <button className="btn btn-ghost" onClick={stopLiveIdentify}>Stop live scan</button>
            </>
          )}
          {result && <p style={{fontSize: 18, fontWeight: 700, color: 'var(--primary)'}}>{result}</p>}
        </div>
      )}

      {tab === 'alerts' && (
        <>
          {alerts.length === 0 ? (
            <p className="empty">No recent sightings in the last 24 hours.</p>
          ) : (
            alerts.map(a => (
              <div key={a.id} style={{display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid var(--border)'}}>
                <img src={resolveUrl(a.imageUrl)} alt="" style={{width: 56, height: 56, borderRadius: 8, objectFit: 'cover'}} />
                <div>
                  <div style={{fontWeight: 700}}>{a.personName || 'Unknown'}</div>
                  <div style={{fontSize: 12, color: 'var(--muted)'}}>
                    {sourceLabel(a)} · {Math.round(a.confidence)}%
                    {a.locationLabel ? ` · ${a.locationLabel}` : ''}
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'trace' && tracePerson && (
        <>
          <h2 style={{fontSize: 18, marginBottom: 12}}>{tracePerson.name} — timeline</h2>
          <div style={{display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap'}}>
            <button className="btn btn-ghost" onClick={() => downloadTraceExport(tracePerson.id, 'csv')}>
              Export CSV
            </button>
            <button className="btn btn-ghost" onClick={() => downloadTraceExport(tracePerson.id, 'json')}>
              Export JSON
            </button>
            <button className="btn btn-ghost" onClick={() => downloadTraceExport(tracePerson.id, 'geojson')}>
              Export map (GeoJSON)
            </button>
          </div>
          {Object.keys(groupedTimeline).length === 0 ? (
            <p className="empty">No sightings yet. Use camera or scan library from the mobile app.</p>
          ) : (
            Object.entries(groupedTimeline).map(([day, entries]) => (
              <div key={day} style={{marginBottom: 20}}>
                <div style={{fontSize: 13, color: 'var(--muted)', marginBottom: 8, fontWeight: 700}}>{day}</div>
                {entries.map(entry => (
                  <div key={entry.id} style={{display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)'}}>
                    <img src={resolveUrl(entry.imageUrl)} alt="" style={{width: 48, height: 48, borderRadius: 8, objectFit: 'cover'}} />
                    <div style={{flex: 1}}>
                      <div style={{fontWeight: 600}}>{sourceLabel(entry)}</div>
                      <div style={{fontSize: 12, color: 'var(--muted)'}}>
                        {Math.round(entry.confidence)}% match
                        {entry.locationLabel ? ` · ${entry.locationLabel}` : ''}
                        {entry.mediaTitle ? ` · ${entry.mediaTitle}` : ''}
                      </div>
                      {entry.latitude != null && entry.longitude != null && (
                        <a
                          href={`https://maps.google.com/?q=${entry.latitude},${entry.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{fontSize: 12}}>
                          Open map
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
