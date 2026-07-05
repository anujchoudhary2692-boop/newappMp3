import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {WebView} from 'react-native-webview';
import {buildLeafletMapHtml, GeoMapPoint} from '../utils/geoMapHtml';

interface Props {
  points: GeoMapPoint[];
  height?: number;
}

export function GeoMapView({points, height = 280}: Props) {
  const html = useMemo(() => buildLeafletMapHtml(points, height), [points, height]);
  if (!points.some(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))) {
    return null;
  }
  return (
    <View style={[styles.wrap, {height}]}>
      <WebView
        originWhitelist={['*']}
        source={{html}}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
