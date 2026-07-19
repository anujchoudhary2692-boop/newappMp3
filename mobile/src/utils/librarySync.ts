import {getAuthToken} from './authStorage';
import {httpRequest} from '../core/api/httpClient';
import {listPlaylists, pullCloudPlaylists} from './playlistStore';
import {listFavorites, pullCloudFavorites} from './favoritesStore';
import {loadRecentMedia, pullCloudRecent} from './recentMedia';

/** After login: push local guest library then pull cloud snapshot. */
export async function migrateAndSyncCloudLibrary(): Promise<void> {
  if (!(await getAuthToken())) return;
  try {
    const playlists = await listPlaylists();
    const favorites = await listFavorites();
    const recent = await loadRecentMedia();
    await httpRequest('/api/library/migrate', {
      method: 'POST',
      body: JSON.stringify({
        playlists,
        favorites,
        recent: recent.map(r => ({
          ...r,
          playedAt: new Date().toISOString(),
        })),
      }),
    });
  } catch {
    // continue to pull
  }
  await Promise.all([pullCloudPlaylists(), pullCloudFavorites(), pullCloudRecent()]);
}
