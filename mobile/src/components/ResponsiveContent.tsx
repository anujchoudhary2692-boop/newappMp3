import React from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {useLayoutMetrics} from '../utils/layout';

interface ResponsiveContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stretch to full width inside centered column (default true). */
  fill?: boolean;
}

/** Centers content on tablets and caps readable width. */
export function ResponsiveContent({children, style, fill = true}: ResponsiveContentProps) {
  const layout = useLayoutMetrics(true);

  return (
    <View
      style={[
        fill && styles.fill,
        {paddingHorizontal: layout.hPad, maxWidth: layout.width, alignSelf: 'center', width: '100%'},
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
