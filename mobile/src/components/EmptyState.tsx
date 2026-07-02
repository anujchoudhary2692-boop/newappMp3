import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, RADIUS, SPACING} from '../config';
import {useLayoutMetrics} from '../utils/layout';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  accentColor?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  accentColor = COLORS.primary,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const layout = useLayoutMetrics(true);
  const iconSize = layout.emptyIcon;

  return (
    <View style={[styles.container, {padding: layout.hPad}]}>
      <LinearGradient
        colors={[`${accentColor}40`, `${accentColor}12`]}
        style={[
          styles.iconWrap,
          {
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize / 2,
          },
        ]}>
        <Icon name={icon} size={iconSize * 0.42} color={accentColor} />
      </LinearGradient>
      <Text style={[styles.title, {fontSize: layout.font.lg}]}>{title}</Text>
      <Text
        style={[
          styles.subtitle,
          {fontSize: layout.font.md, lineHeight: layout.font.lineMd, maxWidth: layout.contentW * 0.85},
        ]}>
        {subtitle}
      </Text>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.action, {backgroundColor: accentColor, paddingHorizontal: layout.hPad}]}
          onPress={onAction}
          activeOpacity={0.88}>
          <Text style={[styles.actionText, {fontSize: layout.font.sm}]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  iconWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    color: COLORS.text,
    fontWeight: '800',
    marginBottom: SPACING.sm,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm + 4,
    borderRadius: RADIUS.lg,
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
  },
});
