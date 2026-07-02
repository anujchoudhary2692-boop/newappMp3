import React from 'react';
import {StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {ENTERPRISE} from '../../theme/enterprise';
import {useLayoutMetrics} from '../../utils/layout';

interface Props {
  value?: string;
  placeholder?: string;
  editable?: boolean;
  onChangeText?: (text: string) => void;
  onPress?: () => void;
  onSubmit?: () => void;
}

export function EnterpriseSearchBar({
  value = '',
  placeholder = 'Search music, videos, artists…',
  editable = true,
  onChangeText,
  onPress,
  onSubmit,
}: Props) {
  const layout = useLayoutMetrics(true);

  const inner = (
    <View style={styles.bar}>
      <Icon name="search" size={18} color="#879596" />
      {editable ? (
        <TextInput
          style={[styles.input, {fontSize: layout.font.md}]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#879596"
          returnKeyType="search"
          onSubmitEditing={onSubmit}
        />
      ) : (
        <Text style={[styles.placeholder, {fontSize: layout.font.md}]} numberOfLines={1}>
          {placeholder}
        </Text>
      )}
      <Icon name="scan-outline" size={18} color="#879596" />
    </View>
  );

  if (!editable && onPress) {
    return (
      <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: ENTERPRISE.searchBg,
    borderRadius: ENTERPRISE.radius.pill,
    borderWidth: 1,
    borderColor: ENTERPRISE.searchBorder,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#fff',
    padding: 0,
  },
  placeholder: {
    flex: 1,
    color: '#879596',
    fontWeight: '500',
  },
});
