import React from 'react';
import {Image, StyleSheet, Text, View, ViewStyle} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {ENTERPRISE} from '../theme/enterprise';

const LOGO_SOURCE = require('../assets/logo.png');

type AppLogoVariant = 'mark' | 'full' | 'splash';

interface AppLogoProps {
  size?: number;
  variant?: AppLogoVariant;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
  showImage?: boolean;
}

/** Branded MediaFace logo — image mark with vector fallback. */
export function AppLogo({
  size = 40,
  variant = 'mark',
  title = 'MediaFace',
  subtitle,
  style,
  showImage = true,
}: AppLogoProps) {
  const imageSize = variant === 'splash' ? size : Math.round(size * 0.92);
  const showTitle = variant === 'full' || variant === 'splash';
  const isSplash = variant === 'splash';

  return (
    <View style={[isSplash ? styles.splashColumn : styles.row, style]}>
      {showImage ? (
        <Image
          source={LOGO_SOURCE}
          style={[
            styles.image,
            {
              width: imageSize,
              height: imageSize,
              borderRadius: variant === 'splash' ? imageSize * 0.22 : imageSize * 0.18,
            },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.fallbackMark,
            {
              width: imageSize,
              height: imageSize,
              borderRadius: imageSize * 0.18,
            },
          ]}>
          <Icon name="play" size={imageSize * 0.42} color={ENTERPRISE.brandDark} />
        </View>
      )}
      {showTitle ? (
        <View style={[styles.textBlock, isSplash && styles.splashText]}>
          <Text
            style={[
              styles.title,
              {fontSize: variant === 'splash' ? size * 0.34 : size * 0.38},
              isSplash && styles.splashTitle,
            ]}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, {fontSize: size * 0.22}, isSplash && styles.splashSubtitle]}
              numberOfLines={1}>
              {subtitle}
            </Text>
          ) : variant === 'splash' ? (
            <Text style={[styles.subtitle, {fontSize: size * 0.2}, styles.splashSubtitle]}>
              Music · Video · AI
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  splashColumn: {
    alignItems: 'center',
    gap: 16,
  },
  image: {
    backgroundColor: ENTERPRISE.headerBg,
  },
  fallbackMark: {
    backgroundColor: ENTERPRISE.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flexShrink: 1,
    minWidth: 0,
  },
  splashText: {
    alignItems: 'center',
  },
  splashTitle: {
    textAlign: 'center',
  },
  splashSubtitle: {
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#C7CED4',
    fontWeight: '600',
    marginTop: 2,
  },
});
