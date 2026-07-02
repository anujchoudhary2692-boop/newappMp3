import React, {useState} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {NavigationContainer, DefaultTheme, getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {MediaNavigator} from './MediaNavigator';
import {CameraNavigator} from './CameraNavigator';
import {FaceNavigator} from './FaceNavigator';
import {MiniPlayer} from '../components/MiniPlayer';
import {COLORS, SHADOW} from '../config';
import {navigationRef} from './navigationRef';
import {RootTabParamList} from './types';
import {tabBarHeight} from '../utils/layout';

const Tab = createBottomTabNavigator<RootTabParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.background,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.primary,
  },
};

function tabIcon(routeName: string, focused: boolean, color: string, size: number) {
  let iconName = 'ellipse-outline';
  if (routeName === 'Media') {
    iconName = focused ? 'play-circle' : 'play-circle-outline';
  } else if (routeName === 'Camera') {
    iconName = focused ? 'camera' : 'camera-outline';
  } else {
    iconName = focused ? 'scan-circle' : 'scan-circle-outline';
  }
  return <Icon name={iconName} size={size + (focused ? 2 : 0)} color={color} />;
}

export function AppNavigator() {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const [routeVersion, setRouteVersion] = useState(0);
  const barHeight = tabBarHeight(insets.bottom, width);

  const defaultTabBarStyle = {
    ...SHADOW.md,
    backgroundColor: '#16161F',
    borderTopWidth: 0,
    height: barHeight,
    paddingBottom: Math.max(insets.bottom, 8),
    paddingTop: 8,
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme}
      onStateChange={() => setRouteVersion(v => v + 1)}>
      <View style={styles.root}>
        <Tab.Navigator
          screenOptions={({route}) => ({
            headerShown: false,
            tabBarStyle: defaultTabBarStyle,
            tabBarActiveTintColor:
              route.name === 'Media'
                ? COLORS.primary
                : route.name === 'Camera'
                  ? COLORS.camera
                  : COLORS.face,
            tabBarInactiveTintColor: COLORS.textMuted,
            tabBarIcon: ({color, size, focused}) =>
              tabIcon(route.name, focused, color, size),
            tabBarLabelStyle: {fontWeight: '700', fontSize: 11, letterSpacing: 0.2},
          })}>
          <Tab.Screen
            name="Media"
            component={MediaNavigator}
            options={{title: 'Media'}}
          />
          <Tab.Screen
            name="Camera"
            component={CameraNavigator}
            options={({route}) => {
              const focused = getFocusedRouteNameFromRoute(route) ?? 'CameraHome';
              const hideBar = focused === 'CameraHome';
              return {
                title: 'Camera',
                tabBarStyle: hideBar
                  ? {...defaultTabBarStyle, display: 'none' as const, height: 0}
                  : defaultTabBarStyle,
              };
            }}
          />
          <Tab.Screen
            name="Faces"
            component={FaceNavigator}
            options={{title: 'Faces'}}
          />
        </Tab.Navigator>
        <MiniPlayer routeVersion={routeVersion} />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.background},
});
