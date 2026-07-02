import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {COLORS, SPACING} from '../config';
import {openSettings} from '../navigation/navigationRef';
import {useLayoutMetrics} from '../utils/layout';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  accentColor?: string;
  rightIcon?: string;
  onRightPress?: () => void;
  secondaryRightIcon?: string;
  onSecondaryRightPress?: () => void;
  showSettings?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  accentColor = COLORS.primary,
  rightIcon,
  onRightPress,
  secondaryRightIcon,
  onSecondaryRightPress,
  showSettings = false,
}: AppHeaderProps) {
  const layout = useLayoutMetrics(true);
  const navigation = useNavigation();
  const btn = layout.headerBtn;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <LinearGradient
      colors={[`${accentColor}28`, `${accentColor}08`, COLORS.background]}
      style={[
        styles.wrap,
        {paddingTop: layout.insets.top + SPACING.xs, paddingHorizontal: layout.hPad},
      ]}>
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity
            style={[styles.iconBox, {width: btn, height: btn, borderRadius: btn / 4}]}
            onPress={handleBack}
            hitSlop={8}>
            <Icon name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={[accentColor, `${accentColor}99`]}
            style={[styles.iconBox, {width: btn, height: btn, borderRadius: btn / 4}]}>
            <Icon name="sparkles" size={layout.isCompact ? 14 : 16} color={COLORS.text} />
          </LinearGradient>
        )}
        <View style={styles.titles}>
          <Text style={[styles.title, {fontSize: layout.font.xl}]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.subtitle,
                {fontSize: layout.isSmallPhone ? layout.font.xs : layout.font.sm},
              ]}
              numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          {rightIcon && onRightPress ? (
            <TouchableOpacity
              style={[styles.iconBox, {width: btn, height: btn, borderRadius: btn / 4}]}
              onPress={onRightPress}>
              <Icon name={rightIcon} size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {secondaryRightIcon && onSecondaryRightPress ? (
            <TouchableOpacity
              style={[styles.iconBox, {width: btn, height: btn, borderRadius: btn / 4}]}
              onPress={onSecondaryRightPress}>
              <Icon name={secondaryRightIcon} size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
          {showSettings ? (
            <TouchableOpacity
              style={[styles.iconBox, {width: btn, height: btn, borderRadius: btn / 4}]}
              onPress={openSettings}>
              <Icon name="color-palette-outline" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={[styles.accentLine, {backgroundColor: accentColor}]} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: 44,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  titles: {flex: 1, minWidth: 0},
  title: {color: COLORS.text, fontWeight: '800', letterSpacing: -0.3},
  subtitle: {color: COLORS.textMuted, marginTop: 2, fontWeight: '600'},
  actions: {flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0},
  accentLine: {
    height: 2,
    width: 40,
    borderRadius: 2,
    marginTop: SPACING.sm,
    opacity: 0.85,
  },
});
