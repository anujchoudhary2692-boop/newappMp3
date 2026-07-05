import React, {useEffect, useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type {MediaSearchResult} from '../features/media/domain/types';
import {
  AUDIO_QUALITY_OPTIONS,
  AudioQuality,
  defaultQuality,
  VIDEO_QUALITY_OPTIONS,
  VideoQuality,
} from '../features/media/domain/qualityPresets';
import {COLORS, RADIUS, SPACING} from '../config';
import {ENTERPRISE} from '../theme/enterprise';
import {useLayoutMetrics} from '../utils/layout';

export type QualityAction = 'play' | 'download';

interface QualityPickerSheetProps {
  visible: boolean;
  item: MediaSearchResult | null;
  mediaType: 'AUDIO' | 'VIDEO';
  action: QualityAction;
  onClose: () => void;
  onConfirm: (quality: AudioQuality | VideoQuality) => void;
}

export function QualityPickerSheet({
  visible,
  item,
  mediaType,
  action,
  onClose,
  onConfirm,
}: QualityPickerSheetProps) {
  const layout = useLayoutMetrics(false);
  const isAudio = mediaType === 'AUDIO';
  const accent = isAudio ? COLORS.audio : COLORS.video;
  const options = isAudio ? AUDIO_QUALITY_OPTIONS : VIDEO_QUALITY_OPTIONS;
  const [selected, setSelected] = useState<string>(defaultQuality(mediaType));

  useEffect(() => {
    if (visible) {
      setSelected(defaultQuality(mediaType));
    }
  }, [visible, mediaType]);

  if (!item) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, {paddingBottom: layout.contentBottomPad}]} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.subtitle}>
            {action === 'play' ? 'Choose quality to play' : 'Choose quality to save on device'}{' '}
            · {isAudio ? 'Audio' : 'Video'}
          </Text>

          <View style={styles.options}>
            {options.map(option => {
              const active = selected === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.option, active && {borderColor: accent, backgroundColor: `${accent}18`}]}
                  onPress={() => setSelected(option.id)}
                  activeOpacity={0.85}>
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, active && {color: accent}]}>{option.label}</Text>
                    <Text style={styles.optionSub}>{option.subtitle}</Text>
                  </View>
                  <Icon
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={active ? accent : COLORS.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, {backgroundColor: accent}]}
            onPress={() => onConfirm(selected as AudioQuality | VideoQuality)}>
            <Icon name={action === 'play' ? 'play' : 'download-outline'} size={20} color="#111" />
            <Text style={styles.confirmText}>
              {action === 'play' ? 'Play now' : 'Save to device'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: ENTERPRISE.cardBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: SPACING.md,
  },
  options: {gap: SPACING.sm, marginBottom: SPACING.lg},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
    backgroundColor: ENTERPRISE.searchBg,
  },
  optionText: {flex: 1, marginRight: SPACING.sm},
  optionLabel: {color: COLORS.text, fontWeight: '700', fontSize: 15},
  optionSub: {color: COLORS.textMuted, fontSize: 12, marginTop: 2},
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
  },
  confirmText: {color: '#111', fontWeight: '800', fontSize: 16},
  cancelBtn: {alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.xs},
  cancelText: {color: COLORS.textMuted, fontWeight: '700', fontSize: 15},
});
