import React from 'react';
import {
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  ViewProps,
} from 'react-native';
import {useLayoutMetrics} from '../utils/layout';

interface ScreenScrollProps extends ScrollViewProps {
  /** Extra bottom space when mini-player may show */
  withMiniPlayerPad?: boolean;
  /** Apply responsive horizontal page padding */
  padded?: boolean;
  children: React.ReactNode;
}

/** ScrollView with correct bottom inset for floating tab bar. */
export function ScreenScroll({
  withMiniPlayerPad = false,
  padded = true,
  contentContainerStyle,
  children,
  ...rest
}: ScreenScrollProps) {
  const layout = useLayoutMetrics(true);
  const bottomPad = withMiniPlayerPad
    ? layout.contentBottomPadWithPlayer
    : layout.contentBottomPad;

  return (
    <ScrollView
      {...rest}
      contentContainerStyle={[
        {
          ...(padded ? {paddingHorizontal: layout.hPad} : null),
          paddingBottom: bottomPad,
        },
        contentContainerStyle,
      ]}>
      {children}
    </ScrollView>
  );
}

interface ScreenViewProps extends ViewProps {
  withMiniPlayerPad?: boolean;
  children: React.ReactNode;
}

/** Flex container with bottom safe padding for tab bar. */
export function ScreenView({
  withMiniPlayerPad = false,
  style,
  children,
  ...rest
}: ScreenViewProps) {
  const layout = useLayoutMetrics(true);
  const bottomPad = withMiniPlayerPad
    ? layout.contentBottomPadWithPlayer
    : layout.contentBottomPad;

  return (
    <View {...rest} style={[styles.flex, {paddingBottom: bottomPad}, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
});
