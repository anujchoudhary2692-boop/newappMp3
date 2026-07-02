import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, SPACING} from '../config';
import {ENTERPRISE} from '../theme/enterprise';
import {useLayoutMetrics, rs} from '../utils/layout';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSearch: () => void;
  placeholder?: string;
  loading?: boolean;
  variant?: 'default' | 'enterprise';
}

export function SearchBar({
  value,
  onChangeText,
  onSearch,
  placeholder = 'Search songs or videos...',
  loading,
  variant = 'enterprise',
}: SearchBarProps) {
  const layout = useLayoutMetrics(true);
  const btnSize = layout.headerBtn;
  const enterprise = variant === 'enterprise';

  return (
    <View style={[styles.container, {paddingHorizontal: layout.hPad, gap: layout.gap}]}>
      <View style={[styles.inputWrap, enterprise && styles.inputWrapEnterprise]}>
        <Icon name="search" size={layout.isCompact ? 18 : 20} color={enterprise ? '#879596' : COLORS.textMuted} />
        <TextInput
          style={[
            styles.input,
            enterprise && styles.inputEnterprise,
            {
              fontSize: layout.font.md,
              paddingVertical: layout.isCompact ? SPACING.sm : SPACING.md,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={enterprise ? '#879596' : COLORS.textMuted}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
            <Icon name="close-circle" size={18} color={enterprise ? '#879596' : COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {layout.isSmallPhone ? (
        <TouchableOpacity
          style={[
            styles.iconBtn,
            enterprise && styles.iconBtnEnterprise,
            {
              width: btnSize,
              height: btnSize,
              borderRadius: rs(14, layout.width),
            },
            loading && styles.buttonDisabled,
          ]}
          onPress={onSearch}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={enterprise ? '#111' : COLORS.text} size="small" />
          ) : (
            <Icon name="arrow-forward" size={20} color={enterprise ? '#111' : COLORS.text} />
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, enterprise && styles.buttonEnterprise, loading && styles.buttonDisabled]}
          onPress={onSearch}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={enterprise ? '#111' : COLORS.text} size="small" />
          ) : (
            <Text style={[styles.buttonText, enterprise && styles.buttonTextEnterprise, {fontSize: layout.font.sm}]}>
              Search
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputWrapEnterprise: {
    backgroundColor: ENTERPRISE.searchBg,
    borderColor: ENTERPRISE.searchBorder,
    borderRadius: ENTERPRISE.radius.pill,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
  },
  inputEnterprise: {
    color: '#fff',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  buttonEnterprise: {
    backgroundColor: ENTERPRISE.brand,
    borderRadius: ENTERPRISE.radius.pill,
  },
  iconBtn: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnEnterprise: {
    backgroundColor: ENTERPRISE.brand,
  },
  buttonDisabled: {opacity: 0.7},
  buttonText: {color: COLORS.text, fontWeight: '700'},
  buttonTextEnterprise: {color: '#111', fontWeight: '800'},
});
