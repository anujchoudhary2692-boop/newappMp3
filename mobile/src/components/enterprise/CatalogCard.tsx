import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {ENTERPRISE} from '../../theme/enterprise';
import {useLayoutMetrics} from '../../utils/layout';

interface CatalogCardProps {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  type?: 'AUDIO' | 'VIDEO';
  badge?: string;
  onPress: () => void;
}

export function CatalogCard({
  title,
  subtitle,
  thumbnailUrl,
  type = 'AUDIO',
  badge,
  onPress,
}: CatalogCardProps) {
  const layout = useLayoutMetrics(true);
  const width = layout.isTablet ? 168 : ENTERPRISE.catalog.cardWidth;
  const imageH = layout.isCompact ? 132 : ENTERPRISE.catalog.imageHeight;
  const accent = type === 'VIDEO' ? '#FF6B9D' : '#4F8CFF';

  return (
    <TouchableOpacity
      style={[styles.card, {width}]}
      onPress={onPress}
      activeOpacity={0.92}>
      <View style={[styles.imageWrap, {height: imageH}]}>
        {thumbnailUrl ? (
          <Image source={{uri: thumbnailUrl}} style={styles.image} />
        ) : (
          <LinearGradient colors={[`${accent}66`, `${accent}22`]} style={styles.image}>
            <Icon name={type === 'VIDEO' ? 'videocam' : 'musical-notes'} size={32} color="#fff" />
          </LinearGradient>
        )}
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={[styles.title, {fontSize: layout.font.sm}]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, {fontSize: layout.font.xs}]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: ENTERPRISE.pageBg,
    borderRadius: ENTERPRISE.radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
  },
  imageWrap: {
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: ENTERPRISE.brand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#111',
    fontSize: 10,
    fontWeight: '800',
  },
  meta: {
    padding: 10,
    gap: 4,
  },
  title: {
    color: '#fff',
    fontWeight: '600',
    lineHeight: 18,
  },
  subtitle: {
    color: '#879596',
    fontWeight: '600',
  },
});
