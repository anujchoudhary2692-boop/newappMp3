import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {COLORS, RADIUS, SHADOW, SPACING} from '../config';
import {useLayoutMetrics} from '../utils/layout';

interface BrowseTileProps {
  title: string;
  subtitle: string;
  icon: string;
  colors: [string, string];
  width?: number;
  onPress: () => void;
}

export function BrowseTile({
  title,
  subtitle,
  icon,
  colors,
  width,
  onPress,
}: BrowseTileProps) {
  const layout = useLayoutMetrics(true);
  const tileW = width ?? Math.max(140, layout.halfGridWidth);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{width: tileW, ...SHADOW.sm}}>
      <LinearGradient colors={colors} style={styles.tile}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={22} color="#fff" />
        </View>
        <Text style={[styles.title, {fontSize: layout.font.lg}]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, {fontSize: layout.font.xs}]} numberOfLines={1}>
          {subtitle}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    height: 112,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  iconWrap: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontWeight: '600',
    marginTop: 2,
  },
});
