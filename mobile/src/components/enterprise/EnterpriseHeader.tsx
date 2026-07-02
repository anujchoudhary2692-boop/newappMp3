import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppLogo} from '../AppLogo';
import {ENTERPRISE} from '../../theme/enterprise';
import {useLayoutMetrics} from '../../utils/layout';
import {openSettings} from '../../navigation/navigationRef';

interface EnterpriseHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showSettings?: boolean;
  showGuide?: boolean;
  onGuide?: () => void;
  searchSlot?: React.ReactNode;
}

export function EnterpriseHeader({
  title = 'MediaFace',
  subtitle,
  showBack,
  onBack,
  showSettings = true,
  showGuide,
  onGuide,
  searchSlot,
}: EnterpriseHeaderProps) {
  const insets = useSafeAreaInsets();
  const layout = useLayoutMetrics(true);

  return (
    <View style={[styles.shell, {paddingTop: insets.top}]}>
      <View style={[styles.topRow, {paddingHorizontal: layout.hPad}]}>
        {showBack ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onBack} hitSlop={8}>
            <Icon name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
        ) : (
          <AppLogo
            size={32}
            variant="full"
            title={title}
            subtitle={subtitle}
            style={styles.brandBlock}
          />
        )}

        <View style={styles.actions}>
          {showGuide && onGuide ? (
            <TouchableOpacity style={styles.iconBtn} onPress={onGuide}>
              <Icon name="help-circle-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {showSettings ? (
            <TouchableOpacity style={styles.iconBtn} onPress={openSettings}>
              <Icon name="person-circle-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {searchSlot ? (
        <View style={[styles.searchWrap, {paddingHorizontal: layout.hPad}]}>{searchSlot}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: ENTERPRISE.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.headerBorder,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingBottom: 8,
  },
  brandBlock: {
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingBottom: 12,
  },
});
