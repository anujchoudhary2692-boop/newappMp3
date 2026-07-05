import {useCallback, useEffect, useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api/client';
import type {Person} from '../types/media';

type Tab = 'people' | 'register' | 'identify';

export function FacesPage() {
  const [tab, setTab] = useState<Tab>('people');
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const st = await api.faceStatus();
      setReady(st.data.ready);
      if (!st.data.ready) {
        setMsg(st.data.message || 'Face AI unavailable on this server.');
        setPeople([]);
        return;
      }
      const res = await api.listFaces();
      setPeople(res.data);
      setMsg('');
    } catch (e) {
      setReady(false);
      setMsg(e instanceof Error ? e.message : 'Face AI unavailable');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      if (d.personName) {
        setResult(`${d.personName}${d.confidence != null ? ` (${Math.round(d.confidence * 100)}%)` : ''}`);
      } else {
        setResult('No match found');
      }
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Identify failed');
    }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this person?')) return;
    await api.deleteFace(id);
    void load();
  };

  return (
    <div className="page">
      <Link to="/" className="btn btn-ghost" style={{marginBottom: 12}}>
        ← Home
      </Link>
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Face AI</h1>

      {ready === false && (
        <p style={{color: 'var(--danger)', marginBottom: 16}}>
          {msg || 'Face AI is disabled on cloud (Render free tier). Use a local backend for face features.'}
        </p>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>
          People
        </button>
        <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
          Register
        </button>
        <button className={`tab ${tab === 'identify' ? 'active' : ''}`} onClick={() => setTab('identify')}>
          Identify
        </button>
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  borderBottom: '1px solid var(--border)',
                }}>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 700}}>{p.name}</div>
                  <div style={{fontSize: 12, color: 'var(--muted)'}}>
                    {p.photoCount ?? 0} photos {p.notes ? `· ${p.notes}` : ''}
                  </div>
                </div>
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
          <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
            📷 Choose photo
          </button>
          <button className="btn btn-primary" onClick={() => void register()}>
            Save face
          </button>
        </div>
      )}

      {tab === 'identify' && (
        <div style={{display: 'grid', gap: 12}}>
          {preview && <img src={preview} alt="" style={{maxWidth: '100%', borderRadius: 12}} />}
          <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
            📷 Choose photo
          </button>
          <button className="btn btn-primary" onClick={() => void identify()}>
            Identify
          </button>
          {result && <p style={{fontSize: 18, fontWeight: 700, color: 'var(--primary)'}}>{result}</p>}
        </div>
      )}
    </div>
  );
}
