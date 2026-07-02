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
import {navigationRef} from './navigationRef';
import {RootStackParamList, RootTabParamList} from './types';
import {ENTERPRISE} from '../theme/enterprise';
import {tabBarVisualHeight} from '../utils/layout';

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

function MainTabs(_props: {routeVersion: number}) {
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const tabHeight = tabBarVisualHeight(width) + Math.max(insets.bottom, 0);

  const defaultTabBarStyle = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: tabHeight,
    paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 6),
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: ENTERPRISE.headerBorder,
    backgroundColor: ENTERPRISE.headerBg,
    elevation: 0,
    shadowOpacity: 0,
  };

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarStyle: defaultTabBarStyle,
        tabBarActiveTintColor: ENTERPRISE.brand,
        tabBarInactiveTintColor: '#879596',
        tabBarIcon: ({color, size, focused}) =>
          tabIcon(route.name, focused, color, size),
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: width < 360 ? 10 : 11,
          letterSpacing: 0.1,
        },
        tabBarHideOnKeyboard: true,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{title: 'Home'}} />
      <Tab.Screen name="Media" component={MediaNavigator} options={{title: 'Browse'}} />
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
  const {themeId} = useTheme();
  const [routeVersion, setRouteVersion] = useState(0);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: ENTERPRISE.pageBg,
      card: ENTERPRISE.cardBg,
      text: '#fff',
      border: ENTERPRISE.divider,
      primary: ENTERPRISE.brand,
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
  rootShell: {flex: 1, backgroundColor: ENTERPRISE.pageBg},
});
