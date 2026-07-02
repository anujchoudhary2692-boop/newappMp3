import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, RADIUS, SPACING} from '../config';
import {useLayoutMetrics} from '../utils/layout';

interface HomeMediaRowProps {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  type: 'AUDIO' | 'VIDEO';
  onPress: () => void;
}

export function HomeMediaRow({
  title,
  subtitle,
  thumbnailUrl,
  type,
  onPress,
}: HomeMediaRowProps) {
  const layout = useLayoutMetrics(true);
  const accent = type === 'VIDEO' ? COLORS.video : COLORS.audio;
  const size = layout.isCompact ? 56 : 64;

  return (
    <TouchableOpacity style={[styles.row, {width: layout.isTablet ? 220 : 168}]} onPress={onPress} activeOpacity={0.88}>
      {thumbnailUrl ? (
        <Image source={{uri: thumbnailUrl}} style={[styles.thumb, {width: size, height: size}]} />
      ) : (
        <LinearGradient colors={[accent, `${accent}88`]} style={[styles.thumb, {width: size, height: size}]}>
          <Icon name={type === 'VIDEO' ? 'videocam' : 'musical-notes'} size={22} color="#fff" />
        </LinearGradient>
      )}
      <Text style={[styles.title, {fontSize: layout.font.sm}]} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, {fontSize: layout.font.xs}]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    marginRight: SPACING.sm,
  },
  thumb: {
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
    backgroundColor: COLORS.surfaceLight,
  },
  title: {
    color: COLORS.text,
    fontWeight: '600',
    lineHeight: 18,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
});
