import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, RADIUS} from '../config';

interface SegmentedControlProps<T extends string> {
  options: {value: T; label: string}[];
  value: T;
  onChange: (value: T) => void;
  accentColor?: string;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accentColor = COLORS.primary,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, active && {backgroundColor: accentColor}]}
            disabled={disabled}
            onPress={() => onChange(opt.value)}>
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface IconToolProps {
  icon: string;
  label?: string;
  active?: boolean;
  accentColor?: string;
  size?: number;
  disabled?: boolean;
  onPress: () => void;
}

export function IconTool({
  icon,
  label,
  active = false,
  accentColor = COLORS.primary,
  size = 42,
  disabled = false,
  onPress,
}: IconToolProps) {
  return (
    <TouchableOpacity
      style={[styles.tool, {width: size, height: size, borderRadius: size / 2}, disabled && styles.toolDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}>
      <View
        style={[
          styles.toolInner,
          active && {backgroundColor: accentColor, borderColor: accentColor},
        ]}>
        <Icon name={icon} size={size * 0.42} color={active ? '#fff' : COLORS.text} />
      </View>
      {label ? (
        <Text style={styles.toolLabel} numberOfLines={1}>{label}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.xl,
    padding: 4,
    alignSelf: 'stretch',
    width: '100%',
  },
  segment: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    minWidth: 0,
    alignItems: 'center',
  },
  label: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  labelActive: {
    color: '#fff',
  },
  tool: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toolDisabled: {
    opacity: 0.35,
  },
  toolInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,14,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  toolLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 56,
    textAlign: 'center',
  },
});
