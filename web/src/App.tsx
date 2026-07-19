import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {Layout} from './components/Layout';
import {PlaybackProvider} from './context/PlaybackContext';
import {CameraPage} from './pages/CameraPage';
import {FacesPage} from './pages/FacesPage';
import {FavoritesPage} from './pages/FavoritesPage';
import {HomePage} from './pages/HomePage';
import {LibraryPage} from './pages/LibraryPage';
import {LoginPage} from './pages/LoginPage';
import {PlayerPage} from './pages/PlayerPage';
import {PlaylistDetailPage} from './pages/PlaylistDetailPage';
import {PlaylistsPage} from './pages/PlaylistsPage';
import {SearchPage} from './pages/SearchPage';
import {SettingsPage} from './pages/SettingsPage';

function AppRoutes() {
  return (
    <PlaybackProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="playlists" element={<PlaylistsPage />} />
          <Route path="playlists/:id" element={<PlaylistDetailPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="faces" element={<FacesPage />} />
          <Route path="camera" element={<CameraPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="player" element={<PlayerPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PlaybackProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
