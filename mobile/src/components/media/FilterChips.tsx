import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import {useLayoutMetrics} from '../../utils/layout';

export interface FilterChipOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface FilterChipsProps<T extends string> {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (id: T) => void;
  accentColor?: string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accentColor = COLORS.primary,
}: FilterChipsProps<T>) {
  const layout = useLayoutMetrics(true);

  return (
    <View style={styles.row}>
      {options.map(opt => {
        const active = value === opt.id;
        const label =
          opt.count != null ? `${opt.label} (${opt.count})` : opt.label;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.chip,
              active && {borderColor: accentColor, backgroundColor: `${accentColor}1F`},
            ]}
            onPress={() => onChange(opt.id)}>
            <Text
              style={[
                styles.chipText,
                {fontSize: layout.font.sm},
                active && {color: accentColor},
              ]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm},
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
    backgroundColor: ENTERPRISE.searchBg,
  },
  chipText: {color: COLORS.textMuted, fontWeight: '700'},
});
