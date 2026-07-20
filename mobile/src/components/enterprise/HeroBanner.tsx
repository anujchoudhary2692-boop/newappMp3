import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {ENTERPRISE} from '../../theme/enterprise';
import {useLayoutMetrics} from '../../utils/layout';

interface HeroBannerProps {
  title: string;
  subtitle: string;
  cta: string;
  colors: [string, string];
  icon: string;
  onPress: () => void;
}

export function HeroBanner({title, subtitle, cta, colors, icon, onPress}: HeroBannerProps) {
  const layout = useLayoutMetrics(true);
  const height = layout.isCompact ? 140 : ENTERPRISE.catalog.bannerHeight;

  return (
    <TouchableOpacity
      activeOpacity={0.94}
      onPress={onPress}
      style={[
        styles.wrap,
        {
          marginHorizontal: layout.hPad,
          height,
          marginTop: layout.gap,
          marginBottom: layout.gap,
        },
      ]}>
      <LinearGradient
        colors={colors}
        style={[
          styles.gradient,
          {
            paddingHorizontal: layout.isCompact ? 14 : 20,
            paddingVertical: layout.isCompact ? 14 : 18,
          },
        ]}>
        <View style={styles.copy}>
          <Text style={[styles.title, {fontSize: layout.font.xl}]}>{title}</Text>
          <Text style={[styles.subtitle, {fontSize: layout.font.sm, lineHeight: layout.font.lineMd}]}>
            {subtitle}
          </Text>
          <View style={styles.ctaRow}>
            <Text style={[styles.cta, {fontSize: layout.font.sm}]}>{cta}</Text>
            <Icon name="arrow-forward" size={14} color="#fff" />
          </View>
        </View>
        <View style={styles.iconCircle}>
          <Icon name={icon} size={34} color="#fff" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: ENTERPRISE.radius.lg,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copy: {flex: 1, paddingRight: 12},
  title: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '600',
    marginTop: 6,
    maxWidth: '92%',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  cta: {
    color: '#fff',
    fontWeight: '800',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
