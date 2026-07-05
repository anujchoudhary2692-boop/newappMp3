import {useState} from 'react';
import {Link} from 'react-router-dom';
import {
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  renamePlaylist,
} from '../stores/playlists';

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState(listPlaylists());
  const [name, setName] = useState('');

  const refresh = () => setPlaylists(listPlaylists());

  const create = () => {
    if (!name.trim()) return;
    createPlaylist(name);
    setName('');
    refresh();
  };

  return (
    <div className="page">
      <h1 style={{fontSize: 24, fontWeight: 800, marginBottom: 16}}>Playlists</h1>
      <div className="search-bar">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New playlist name" />
        <button className="btn btn-primary" onClick={create}>Create</button>
      </div>
      {playlists.length === 0 ? (
        <p className="empty">Create a playlist, then add tracks from search.</p>
      ) : (
        playlists.map(pl => (
          <div
            key={pl.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
            <Link to={`/playlists/${pl.id}`} style={{flex: 1, fontWeight: 700}}>
              {pl.name} <span style={{color: 'var(--muted)', fontWeight: 400}}>({pl.items.length})</span>
            </Link>
            <button
              className="btn btn-ghost"
              onClick={() => {
                const n = prompt('Rename playlist', pl.name);
                if (n) { renamePlaylist(pl.id, n); refresh(); }
              }}>
              ✏️
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (confirm('Delete playlist?')) { deletePlaylist(pl.id); refresh(); }
              }}>
              🗑
            </button>
          </div>
        ))
      )}
    </div>
  );
}
