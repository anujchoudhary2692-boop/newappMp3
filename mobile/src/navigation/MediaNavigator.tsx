import React from 'react';
import {StyleSheet, View} from 'react-native';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {RouteProp, useRoute} from '@react-navigation/native';
import {EnterpriseHeader} from '../components/enterprise/EnterpriseHeader';
import {SearchScreen} from '../screens/media/SearchScreen';
import {LibraryScreen} from '../screens/media/LibraryScreen';
import {PlayerScreen} from '../screens/media/PlayerScreen';
import {MediaStackParamList} from './types';
import {openGuide} from './navigationRef';
import {useLayoutMetrics} from '../utils/layout';
import {ENTERPRISE, enterpriseStyles} from '../theme/enterprise';

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
            height: layout.isCompact ? 44 : 48,
          },
        ],
        tabBarIndicatorStyle: styles.tabIndicator,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#879596',
        tabBarLabelStyle: [styles.tabLabel, {fontSize: layout.font.sm}],
        tabBarItemStyle: styles.tabItem,
        tabBarPressColor: 'rgba(255,153,0,0.12)',
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
    <View style={enterpriseStyles.page}>
      <EnterpriseHeader
        title="Browse"
        subtitle="Search · Stream · Download"
        showGuide
        onGuide={openGuide}
      />
      <MediaTabs />
    </View>
  );
}

export function MediaNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: ENTERPRISE.pageBg},
      }}>
      <Stack.Screen name="Search" component={MediaHome} />
      <Stack.Screen name="Player" component={PlayerScreen} options={{headerShown: false}} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: ENTERPRISE.searchBg,
    elevation: 0,
    shadowOpacity: 0,
    borderWidth: 1,
    borderColor: ENTERPRISE.searchBorder,
    borderRadius: ENTERPRISE.radius.md,
    marginBottom: 4,
    overflow: 'hidden',
  },
  tabIndicator: {
    backgroundColor: ENTERPRISE.brand,
    height: 3,
    borderRadius: 2,
  },
  tabLabel: {fontWeight: '700', textTransform: 'none'},
  tabItem: {minHeight: 42},
});
