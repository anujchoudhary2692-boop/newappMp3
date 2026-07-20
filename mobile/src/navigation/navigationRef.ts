import {createNavigationContainerRef} from '@react-navigation/native';
import {PlayableMedia} from '../api/client';
import {setPendingSearchQuery} from '../utils/searchIntent';
import {RootStackParamList, RootTabParamList} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function whenReady(action: () => void, waitMs = 5000): void {
  if (navigationRef.isReady()) {
    action();
    return;
  }
  const started = Date.now();
  const timer = setInterval(() => {
    if (navigationRef.isReady()) {
      clearInterval(timer);
      action();
    } else if (Date.now() - started > waitMs) {
      clearInterval(timer);
    }
  }, 50);
}

function getMainTabState() {
  if (!navigationRef.isReady()) {
    return null;
  }
  const root = navigationRef.getRootState();
  if (!root) {
    return null;
  }
  const mainRoute = root.routes.find(r => r.name === 'Main') ?? root.routes[root.index ?? 0];
  if (!mainRoute || mainRoute.name !== 'Main' || !mainRoute.state) {
    return null;
  }
  return mainRoute.state;
}

export function isPlayerScreenOpen(): boolean {
  const tabState = getMainTabState();
  if (!tabState) {
    return false;
  }
  const tab = tabState.routes[tabState.index ?? 0];
  if (!tab || tab.name !== 'Media' || !tab.state) {
    return false;
  }
  const stack = tab.state as {routes: {name: string}[]; index?: number};
  return stack.routes[stack.index ?? 0]?.name === 'Player';
}

export function getCurrentTab(): keyof RootTabParamList | null {
  const tabState = getMainTabState();
  if (!tabState) {
    return null;
  }
  return tabState.routes[tabState.index ?? 0]?.name as keyof RootTabParamList;
}

export function shouldHideMiniPlayer(): boolean {
  const tab = getCurrentTab();
  return tab === 'Camera' || tab === 'Home';
}

export function openSettings(): void {
  whenReady(() => navigationRef.navigate('Settings'));
}

export function openGuide(): void {
  whenReady(() => navigationRef.navigate('Guide'));
}

export function goToHomeTab(): void {
  whenReady(() => navigationRef.navigate('Main', {screen: 'Home'}));
}

export function goToMediaTab(
  tab: 'SearchTab' | 'DownloadsTab' | 'PlaylistsTab' | 'FavoritesTab' | 'AudioTab' | 'VideoTab' = 'SearchTab',
  searchQuery?: string,
): void {
  whenReady(() => {
    if (searchQuery) {
      setPendingSearchQuery(searchQuery);
    }
    navigationRef.navigate('Main', {
      screen: 'Media',
      params: {
        screen: 'Search',
        params: tab ? {tab} : undefined,
      },
    });
  });
}

export function goToCameraTab(): void {
  whenReady(() => navigationRef.navigate('Main', {screen: 'Camera'}));
}

export function goToFacesTab(): void {
  whenReady(() => navigationRef.navigate('Main', {screen: 'Faces'}));
}

export function openPlayerScreen(media: PlayableMedia, streamUrl: string): void {
  whenReady(() => {
    navigationRef.navigate('Main', {
      screen: 'Media',
      params: {
        screen: 'Player',
        params: {media, streamUrl},
      },
    });
  });
}

/** @deprecated use goToMediaTab() */
export function goToMediaTabLegacy(): void {
  goToMediaTab('SearchTab');
}
