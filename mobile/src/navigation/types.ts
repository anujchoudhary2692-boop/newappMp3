import {NavigatorScreenParams} from '@react-navigation/native';

export type MediaStackParamList = {
  Search: {tab?: 'SearchTab' | 'DownloadsTab' | 'AudioTab' | 'VideoTab'} | undefined;
  Player: {
    item?: import('../api/client').MediaItem;
    media?: import('../api/client').PlayableMedia;
    streamUrl: string;
  };
};

export type FaceStackParamList = {
  FaceHome: undefined;
  RegisterFace: undefined;
  IdentifyFace: undefined;
  PersonPhotos: {personId: string; personName: string};
};

export type CameraStackParamList = {
  CameraHome: undefined;
  CapturesGallery: undefined;
  CaptureDetail: {captureId: string};
};

export type RootTabParamList = {
  Home: undefined;
  Media: NavigatorScreenParams<MediaStackParamList> | undefined;
  Camera: NavigatorScreenParams<CameraStackParamList> | undefined;
  Faces: NavigatorScreenParams<FaceStackParamList> | undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<RootTabParamList> | undefined;
  Settings: undefined;
  Guide: undefined;
};
