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
import {useLayoutMetrics, rs} from '../utils/layout';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSearch: () => void;
  placeholder?: string;
  loading?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onSearch,
  placeholder = 'Search songs or videos...',
  loading,
}: SearchBarProps) {
  const layout = useLayoutMetrics(true);
  const btnSize = layout.headerBtn;

  return (
    <View style={[styles.container, {paddingHorizontal: layout.hPad, gap: layout.gap}]}>
      <View style={styles.inputWrap}>
        <Icon name="search" size={layout.isCompact ? 18 : 20} color={COLORS.textMuted} />
        <TextInput
          style={[
            styles.input,
            {
              fontSize: layout.font.md,
              paddingVertical: layout.isCompact ? SPACING.sm : SPACING.md,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
            <Icon name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {layout.isSmallPhone ? (
        <TouchableOpacity
          style={[
            styles.iconBtn,
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
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : (
            <Icon name="arrow-forward" size={20} color={COLORS.text} />
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSearch}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.text} size="small" />
          ) : (
            <Text style={[styles.buttonText, {fontSize: layout.font.sm}]}>Search</Text>
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
  input: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  iconBtn: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {opacity: 0.7},
  buttonText: {color: COLORS.text, fontWeight: '700'},
});
