import {createNavigationContainerRef} from '@react-navigation/native';
import {PlayableMedia} from '../api/client';
import {setPendingSearchQuery} from '../utils/searchIntent';
import {RootStackParamList, RootTabParamList} from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function getMainTabState() {
  const root = navigationRef.getRootState();
  if (!root) {
    return null;
  }
  const mainRoute = root.routes.find(r => r.name === 'Main') ?? root.routes[root.index ?? 0];
  if (mainRoute.name !== 'Main' || !mainRoute.state) {
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
  if (tab.name !== 'Media' || !tab.state) {
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
  if (navigationRef.isReady()) {
    navigationRef.navigate('Settings');
  }
}

export function openGuide(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Guide');
  }
}

export function goToHomeTab(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', {screen: 'Home'});
  }
}

export function goToMediaTab(
  tab: 'SearchTab' | 'DownloadsTab' | 'AudioTab' | 'VideoTab' = 'SearchTab',
  searchQuery?: string,
): void {
  if (!navigationRef.isReady()) {
    return;
  }
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
}

export function goToCameraTab(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', {screen: 'Camera'});
  }
}

export function goToFacesTab(): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', {screen: 'Faces'});
  }
}

export function openPlayerScreen(media: PlayableMedia, streamUrl: string): void {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate('Main', {
    screen: 'Media',
    params: {
      screen: 'Player',
      params: {media, streamUrl},
    },
  });
}

/** @deprecated use goToMediaTab() */
export function goToMediaTabLegacy(): void {
  goToMediaTab('SearchTab');
}