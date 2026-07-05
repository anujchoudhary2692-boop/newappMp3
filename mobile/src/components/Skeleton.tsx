import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View, ViewStyle} from 'react-native';
import {COLORS, RADIUS, SPACING} from '../config';
import {ENTERPRISE} from '../theme/enterprise';
import {useLayoutMetrics} from '../utils/layout';

interface SkeletonBoxProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({
  width,
  height,
  borderRadius = RADIUS.sm,
  style,
}: SkeletonBoxProps) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.75,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.box,
        {width, height, borderRadius, opacity: pulse},
        style,
      ]}
    />
  );
}

export function MediaCardSkeleton() {
  const layout = useLayoutMetrics(true);
  const thumb = layout.thumbSize;
  const circle = layout.actionCircle;

  return (
    <View style={[styles.card, {marginHorizontal: layout.hPad, borderColor: ENTERPRISE.cardBorder, backgroundColor: ENTERPRISE.cardBg}]}>
      <SkeletonBox width={thumb} height={thumb} borderRadius={RADIUS.md} />
      <View style={styles.cardBody}>
        <SkeletonBox width="92%" height={layout.font.md} />
        <SkeletonBox width="65%" height={layout.font.sm} style={styles.gapSm} />
        <View style={styles.actionRow}>
          <SkeletonBox width={circle} height={circle} borderRadius={circle / 2} />
          <SkeletonBox width={circle} height={circle} borderRadius={circle / 2} />
          <SkeletonBox width={circle} height={circle} borderRadius={circle / 2} />
          <SkeletonBox width={circle} height={circle} borderRadius={circle / 2} />
        </View>
      </View>
    </View>
  );
}

export function MediaListSkeleton({count = 5}: {count?: number}) {
  return (
    <View style={styles.list}>
      {Array.from({length: count}, (_, index) => (
        <MediaCardSkeleton key={index} />
      ))}
    </View>
  );
}

export function PersonCardSkeleton() {
  return (
    <View style={styles.personCard}>
      <SkeletonBox width={56} height={56} borderRadius={28} />
      <View style={styles.personBody}>
        <SkeletonBox width="55%" height={16} />
        <SkeletonBox width="35%" height={12} style={styles.gapSm} />
      </View>
    </View>
  );
}

export function PersonListSkeleton({count = 4}: {count?: number}) {
  return (
    <View style={styles.list}>
      {Array.from({length: count}, (_, index) => (
        <PersonCardSkeleton key={index} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.surfaceLight,
  },
  card: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
  },
  gapSm: {
    marginTop: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  list: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  personBody: {
    flex: 1,
    marginLeft: SPACING.md,
  },
});
