import React, {useState} from 'react';
import {Platform, StyleSheet, useWindowDimensions, View} from 'react-native';
import {NavigationContainer, DefaultTheme, getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HomeScreen} from '../screens/HomeScreen';
import {MediaNavigator} from './MediaNavigator';
import {CameraNavigator} from './CameraNavigator';
import {FaceNavigator} from './FaceNavigator';
import {MiniPlayer} from '../components/MiniPlayer';
import {SettingsScreen} from '../screens/SettingsScreen';
import {GuideScreen} from '../screens/GuideScreen';
import {useTheme} from '../context/ThemeContext';
import {SHADOW} from '../config';
import {navigationRef} from './navigationRef';
import {RootStackParamList, RootTabParamList} from './types';
import {
  TAB_BAR_FLOAT_MARGIN,
  TAB_BAR_SIDE_MARGIN,
  rs,
  tabBarVisualHeight,
} from '../utils/layout';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

function tabIcon(routeName: string, focused: boolean, color: string, size: number) {
  const s = focused ? size + 1 : size - 1;
  if (routeName === 'Home') {
    return <Icon name={focused ? 'home' : 'home-outline'} size={s} color={color} />;
  }
  if (routeName === 'Media') {
    return <Icon name={focused ? 'play-circle' : 'play-circle-outline'} size={s} color={color} />;
  }
  if (routeName === 'Camera') {
    return <Icon name={focused ? 'camera' : 'camera-outline'} size={s} color={color} />;
  }
  return <Icon name={focused ? 'scan-circle' : 'scan-circle-outline'} size={s} color={color} />;
}

function tabColor(routeName: string, colors: ReturnType<typeof useTheme>['colors']): string {
  if (routeName === 'Home') return colors.accent;
  if (routeName === 'Media') return colors.primary;
  if (routeName === 'Camera') return colors.camera;
  return colors.face;
}

function MainTabs(_props: {routeVersion: number}) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const {colors} = useTheme();
  const bottom = Math.max(insets.bottom, TAB_BAR_FLOAT_MARGIN);
  const side = rs(TAB_BAR_SIDE_MARGIN, width);
  const tabHeight = tabBarVisualHeight(width);

  const defaultTabBarStyle = {
    position: 'absolute' as const,
    left: side,
    right: side,
    bottom,
    height: tabHeight,
    paddingBottom: Platform.OS === 'ios' ? 6 : 4,
    paddingTop: 6,
    borderRadius: rs(26, width),
    borderTopWidth: 0,
    backgroundColor: `${colors.surface}F5`,
    ...SHADOW.md,
  };

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: defaultTabBarStyle,
        tabBarActiveTintColor: tabColor(route.name, colors),
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({color, size, focused}) =>
          tabIcon(route.name, focused, color, size),
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: width < 360 ? 9 : width >= 768 ? 11 : 10,
          letterSpacing: 0.2,
          marginTop: -2,
        },
        tabBarHideOnKeyboard: true,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{title: 'Home'}} />
      <Tab.Screen name="Media" component={MediaNavigator} options={{title: 'Media'}} />
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
      <Tab.Screen name="Faces" component={FaceNavigator} options={{title: 'Faces'}} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const {colors, themeId} = useTheme();
  const [routeVersion, setRouteVersion] = useState(0);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      key={themeId}
      onStateChange={() => setRouteVersion(v => v + 1)}>
      <View style={styles.rootShell}>
        <RootStack.Navigator screenOptions={{headerShown: false}}>
          <RootStack.Screen name="Main">
            {() => <MainTabs routeVersion={routeVersion} />}
          </RootStack.Screen>
          <RootStack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{presentation: 'modal'}}
          />
          <RootStack.Screen
            name="Guide"
            component={GuideScreen}
            options={{presentation: 'modal'}}
          />
        </RootStack.Navigator>
        <MiniPlayer routeVersion={routeVersion} />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  rootShell: {flex: 1},
});
