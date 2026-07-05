import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {FaceHomeScreen} from '../screens/face/FaceHomeScreen';
import {RegisterFaceScreen} from '../screens/face/RegisterFaceScreen';
import {IdentifyFaceScreen} from '../screens/face/IdentifyFaceScreen';
import {PersonPhotosScreen} from '../screens/face/PersonPhotosScreen';
import {PersonTimelineScreen} from '../screens/face/PersonTimelineScreen';
import {AlertsFeedScreen} from '../screens/face/AlertsFeedScreen';
import {COLORS} from '../config';
import {FaceStackParamList} from './types';

const Stack = createNativeStackNavigator<FaceStackParamList>();

export function FaceNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {backgroundColor: COLORS.background},
      }}>
      <Stack.Screen name="FaceHome" component={FaceHomeScreen} />
      <Stack.Screen name="RegisterFace" component={RegisterFaceScreen} />
      <Stack.Screen name="IdentifyFace" component={IdentifyFaceScreen} />
      <Stack.Screen name="PersonPhotos" component={PersonPhotosScreen} />
      <Stack.Screen name="PersonTimeline" component={PersonTimelineScreen} />
      <Stack.Screen name="AlertsFeed" component={AlertsFeedScreen} />
    </Stack.Navigator>
  );
}
