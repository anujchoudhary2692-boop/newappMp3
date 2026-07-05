import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {COLORS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import {useLayoutMetrics} from '../../utils/layout';

interface MediaListHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function MediaListHeader({title, subtitle, action, children, style}: MediaListHeaderProps) {
  const layout = useLayoutMetrics(true);

  return (
    <View style={[styles.wrap, {paddingHorizontal: layout.hPad}, style]}>
      <View style={styles.topRow}>
        <View style={styles.titles}>
          <Text style={[styles.title, {fontSize: layout.font.xl}]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, {fontSize: layout.font.sm}]}>{subtitle}</Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.divider,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  titles: {flex: 1},
  title: {color: COLORS.text, fontWeight: '800'},
  subtitle: {color: COLORS.textMuted, marginTop: 4},
});
