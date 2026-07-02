import React from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {ENTERPRISE} from '../../theme/enterprise';
import {SPACING} from '../../config';
import {useLayoutMetrics} from '../../utils/layout';

interface CatalogSectionProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

export function CatalogSection({
  title,
  subtitle,
  actionLabel = 'See all',
  onAction,
  children,
}: CatalogSectionProps) {
  const layout = useLayoutMetrics(true);

  return (
    <View style={styles.section}>
      <View style={[styles.header, {paddingHorizontal: layout.hPad}]}>
        <View style={styles.headerText}>
          <Text style={[styles.title, {fontSize: layout.font.lg}]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, {fontSize: layout.font.sm}]}>{subtitle}</Text>
          ) : null}
        </View>
        {onAction ? (
          <TouchableOpacity style={styles.action} onPress={onAction} hitSlop={8}>
            <Text style={[styles.actionText, {fontSize: layout.font.sm}]}>{actionLabel}</Text>
            <Icon name="chevron-forward" size={14} color={ENTERPRISE.link} />
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, {paddingHorizontal: layout.hPad}]}>
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: ENTERPRISE.cardBg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: ENTERPRISE.divider,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  headerText: {flex: 1},
  title: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: '#879596',
    fontWeight: '600',
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  actionText: {
    color: ENTERPRISE.link,
    fontWeight: '700',
  },
  scroll: {
    gap: SPACING.sm,
  },
});
