import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, RADIUS, SHADOW, SPACING} from '../config';
import {useLayoutMetrics} from '../utils/layout';

interface FeatureCardProps {
  icon: string;
  title: string;
  subtitle: string;
  colors: [string, string];
  accent: string;
  badge?: string;
  onPress: () => void;
  width?: number;
}

export function FeatureCard({
  icon,
  title,
  subtitle,
  colors,
  accent,
  badge,
  onPress,
  width,
}: FeatureCardProps) {
  const layout = useLayoutMetrics(true);
  const cardW = width ?? layout.featureCardWidth;
  const iconBox = layout.actionCircle;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={{width: cardW, ...SHADOW.sm}}>
      <LinearGradient
        colors={colors}
        style={[
          styles.card,
          {
            padding: layout.isCompact ? SPACING.sm + 2 : SPACING.md,
            minHeight: layout.isCompact ? 76 : 88,
          },
        ]}>
        <View
          style={[
            styles.iconCircle,
            {
              width: iconBox,
              height: iconBox,
              borderRadius: iconBox / 2,
              backgroundColor: `${accent}30`,
            },
          ]}>
          <Icon name={icon} size={layout.isCompact ? 18 : 22} color={accent} />
        </View>
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, {fontSize: layout.font.lg}]} numberOfLines={1}>
              {title}
            </Text>
            {badge ? (
              <View style={[styles.badge, {backgroundColor: accent}]}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.subtitle, {fontSize: layout.font.xs}]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Icon name="chevron-forward" size={16} color={COLORS.textMuted} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  iconCircle: {alignItems: 'center', justifyContent: 'center'},
  textBlock: {flex: 1, minWidth: 0},
  titleRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  title: {color: COLORS.text, fontWeight: '800', flexShrink: 1},
  badge: {paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm},
  badgeText: {color: '#fff', fontSize: 9, fontWeight: '800'},
  subtitle: {color: COLORS.textSecondary, marginTop: 3, fontWeight: '600', lineHeight: 16},
});
