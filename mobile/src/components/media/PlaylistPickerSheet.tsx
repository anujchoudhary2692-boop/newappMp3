import React from 'react';
import {FlatList, Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import type {Playlist} from '../../utils/playlistStore';
import {useLayoutMetrics} from '../../utils/layout';

interface PlaylistPickerSheetProps {
  visible: boolean;
  playlists: Playlist[];
  onClose: () => void;
  onSelect: (playlistId: string) => void;
  onCreateNew: () => void;
}

export function PlaylistPickerSheet({
  visible,
  playlists,
  onClose,
  onSelect,
  onCreateNew,
}: PlaylistPickerSheetProps) {
  const layout = useLayoutMetrics(true);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, {maxWidth: layout.modalMaxWidth, alignSelf: 'center', width: '100%'}]}>
          <Text style={[styles.title, {fontSize: layout.font.lg}]}>Add to playlist</Text>
          <TouchableOpacity style={styles.newRow} onPress={onCreateNew}>
            <Icon name="add" size={20} color={COLORS.primary} />
            <Text style={[styles.newText, {fontSize: layout.font.md}]}>Create new playlist</Text>
          </TouchableOpacity>
          <FlatList
            data={playlists}
            keyExtractor={p => p.id}
            renderItem={({item}) => (
              <TouchableOpacity style={styles.row} onPress={() => onSelect(item.id)}>
                <Text style={[styles.name, {fontSize: layout.font.md}]}>{item.name}</Text>
                <Text style={[styles.count, {fontSize: layout.font.sm}]}>{item.items.length} tracks</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, {fontSize: layout.font.md}]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: ENTERPRISE.cardBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '60%',
  },
  title: {color: COLORS.text, fontWeight: '800', marginBottom: SPACING.md},
  newRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: SPACING.md},
  newText: {color: COLORS.primary, fontWeight: '700'},
  row: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.divider,
  },
  name: {color: COLORS.text, fontWeight: '700'},
  count: {color: COLORS.textMuted},
  cancelBtn: {alignItems: 'center', paddingVertical: SPACING.md},
  cancelText: {color: COLORS.textMuted, fontWeight: '700'},
});
