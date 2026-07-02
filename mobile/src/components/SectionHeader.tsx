import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, SPACING} from '../config';
import {useLayoutMetrics} from '../utils/layout';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({title, subtitle, actionLabel, onAction}: SectionHeaderProps) {
  const layout = useLayoutMetrics(true);

  return (
    <View style={[styles.row, {paddingHorizontal: layout.hPad}]}>
      <View style={styles.texts}>
        <Text style={[styles.title, {fontSize: layout.font.lg}]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, {fontSize: layout.font.sm}]}>{subtitle}</Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.action} onPress={onAction} hitSlop={8}>
          <Text style={[styles.actionText, {fontSize: layout.font.sm}]}>{actionLabel}</Text>
          <Icon name="chevron-forward" size={14} color={COLORS.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  texts: {flex: 1},
  title: {
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  actionText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
