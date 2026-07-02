import React from 'react';
import {StyleSheet} from 'react-native';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {RouteProp, useRoute} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import {AppHeader} from '../components/AppHeader';
import {SearchScreen} from '../screens/media/SearchScreen';
import {LibraryScreen} from '../screens/media/LibraryScreen';
import {PlayerScreen} from '../screens/media/PlayerScreen';
import {COLORS, GRADIENTS, RADIUS} from '../config';
import {MediaStackParamList} from './types';
import {useLayoutMetrics} from '../utils/layout';

const Stack = createNativeStackNavigator<MediaStackParamList>();
const TopTabs = createMaterialTopTabNavigator();

function MediaTabs() {
  const route = useRoute<RouteProp<MediaStackParamList, 'Search'>>();
  const layout = useLayoutMetrics(true);
  const initialTab = route.params?.tab ?? 'SearchTab';

  return (
    <TopTabs.Navigator
      initialRouteName={initialTab}
      screenOptions={{
        tabBarStyle: [
          styles.tabBar,
          {
            marginHorizontal: layout.hPad,
            height: layout.isCompact ? 42 : 46,
          },
        ],
        tabBarIndicatorStyle: styles.tabIndicator,
        tabBarActiveTintColor: COLORS.text,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: [styles.tabLabel, {fontSize: layout.font.sm}],
        tabBarItemStyle: styles.tabItem,
        tabBarPressColor: 'rgba(79, 140, 255, 0.12)',
      }}>
      <TopTabs.Screen name="SearchTab" component={SearchScreen} options={{title: 'Search'}} />
      <TopTabs.Screen name="AudioTab" options={{title: 'Music'}}>
        {() => <LibraryScreen type="AUDIO" />}
      </TopTabs.Screen>
      <TopTabs.Screen name="VideoTab" options={{title: 'Videos'}}>
        {() => <LibraryScreen type="VIDEO" />}
      </TopTabs.Screen>
    </TopTabs.Navigator>
  );
}

function MediaHome() {
  return (
    <LinearGradient colors={GRADIENTS.media} style={styles.root}>
      <AppHeader title="Discover" accentColor={COLORS.primary} variant="minimal" showSettings />
      <MediaTabs />
    </LinearGradient>
  );
}

export function MediaNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: COLORS.background},
      }}>
      <Stack.Screen name="Search" component={MediaHome} />
      <Stack.Screen name="Player" component={PlayerScreen} options={{headerShown: false}} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  tabBar: {
    backgroundColor: 'rgba(18, 18, 28, 0.92)',
    elevation: 0,
    shadowOpacity: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.lg,
    marginBottom: 4,
    overflow: 'hidden',
  },
  tabIndicator: {
    backgroundColor: COLORS.primary,
    height: 3,
    borderRadius: 2,
  },
  tabLabel: {fontWeight: '700', textTransform: 'none'},
  tabItem: {minHeight: 40},
});
