import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {ENTERPRISE} from '../../theme/enterprise';
import {SPACING} from '../../config';
import {useLayoutMetrics} from '../../utils/layout';

export interface ServiceItem {
  id: string;
  label: string;
  icon: string;
  color: string;
  onPress: () => void;
}

interface ServiceGridProps {
  items: ServiceItem[];
}

export function ServiceGrid({items}: ServiceGridProps) {
  const layout = useLayoutMetrics(true);
  const cols = 4;
  const gap = 8;
  const cellW = (layout.contentW - gap * (cols - 1)) / cols;

  return (
    <View style={[styles.grid, {paddingHorizontal: layout.hPad, gap}]}>
      {items.map(item => (
        <TouchableOpacity
          key={item.id}
          style={[styles.cell, {width: cellW}]}
          onPress={item.onPress}
          activeOpacity={0.88}>
          <View style={[styles.iconWrap, {backgroundColor: `${item.color}22`, borderColor: `${item.color}44`}]}>
            <Icon name={item.icon} size={layout.isCompact ? 20 : 22} color={item.color} />
          </View>
          <Text style={[styles.label, {fontSize: layout.font.xs}]} numberOfLines={2}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconWrap: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 72,
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    backgroundColor: ENTERPRISE.cardBg,
  },
  label: {
    color: '#E3E6E6',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },
});
