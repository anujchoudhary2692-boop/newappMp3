import React, {useCallback, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AppHeader} from '../../components/AppHeader';
import {EmptyState} from '../../components/EmptyState';
import {PersonListSkeleton} from '../../components/Skeleton';
import {api, FaceStatus, Person} from '../../api/client';
import {COLORS, GRADIENTS, RADIUS, SHADOW, SPACING} from '../../config';
import {FaceStackParamList} from '../../navigation/types';
import {useLayoutMetrics} from '../../utils/layout';

type Nav = NativeStackNavigationProp<FaceStackParamList>;

export function FaceHomeScreen() {
  const layout = useLayoutMetrics(true);
  const navigation = useNavigation<Nav>();
  const [persons, setPersons] = useState<Person[]>([]);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [personsRes, statusRes] = await Promise.allSettled([
        api.getPersons(),
        api.getFaceStatus(),
      ]);

      if (personsRes.status === 'fulfilled' && personsRes.value.success) {
        setPersons(personsRes.value.data || []);
      } else if (personsRes.status === 'rejected') {
        Alert.alert('Error', personsRes.reason?.message || 'Could not load people');
      }

      if (statusRes.status === 'fulfilled' && statusRes.value.success) {
        setStatus(statusRes.value.data);
      }
    } catch {
      Alert.alert('Error', 'Could not load face recognition data');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = async (person: Person) => {
    try {
      const response = await api.deletePerson(person.id);
      if (response.success) {
        load();
      } else {
        Alert.alert('Delete failed', response.message || 'Try again');
      }
    } catch {
      Alert.alert('Delete failed', 'Could not remove person');
    }
  };

  const confirmDelete = (person: Person) => {
    Alert.alert(
      `Remove ${person.name}?`,
      'This deletes their face profile and all matched photos.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Remove', style: 'destructive', onPress: () => handleDelete(person)},
      ],
    );
  };

  const openEdit = (person: Person) => {
    setEditingPerson(person);
    setEditName(person.name);
    setEditNotes(person.notes || '');
  };

  const saveEdit = async () => {
    if (!editingPerson || !editName.trim()) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }
    setSavingEdit(true);
    try {
      const response = await api.updatePerson(editingPerson.id, {
        name: editName.trim(),
        notes: editNotes.trim(),
      });
      if (response.success) {
        setEditingPerson(null);
        load();
      } else {
        Alert.alert('Could not save', response.message || 'Try again');
      }
    } catch {
      Alert.alert('Could not save', 'Check your connection and try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const personActions = (person: Person) => {
    Alert.alert(person.name, undefined, [
      {text: 'Edit name & notes', onPress: () => openEdit(person)},
      {
        text: 'View photos',
        onPress: () =>
          navigation.navigate('PersonPhotos', {
            personId: person.id,
            personName: person.name,
          }),
      },
      {text: 'Remove person', style: 'destructive', onPress: () => confirmDelete(person)},
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="People"
        subtitle="Find people in group photos & videos"
        accentColor={COLORS.face}
        showSettings
      />
      <LinearGradient
        colors={GRADIENTS.face}
        style={[styles.hero, {paddingHorizontal: layout.hPad}]}>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, status?.engineReady ? styles.statusOk : styles.statusBad]}>
            <Icon
              name={status?.engineReady ? 'checkmark-circle' : 'warning'}
              size={14}
              color={status?.engineReady ? COLORS.success : COLORS.warning}
            />
            <Text style={styles.statusText}>
              {status?.engineReady
                ? `AI ready · ${status.registeredCount} people`
                : status?.message || 'Starting AI...'}
            </Text>
          </View>
        </View>
        <View style={[styles.heroActions, layout.isSmallPhone && styles.heroActionsStack]}>
          <TouchableOpacity
            style={[styles.primaryBtn, {paddingVertical: layout.isCompact ? SPACING.sm : SPACING.md}]}
            onPress={() => navigation.navigate('RegisterFace')}>
            <Icon name="person-add" size={layout.font.md} color={COLORS.background} />
            <Text style={[styles.primaryBtnText, {fontSize: layout.font.sm}]}>Add Person</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, {paddingVertical: layout.isCompact ? SPACING.sm : SPACING.md}]}
            onPress={() => navigation.navigate('IdentifyFace')}>
            <Icon name="scan" size={layout.font.md} color={COLORS.face} />
            <Text style={[styles.secondaryBtnText, {fontSize: layout.font.sm}]}>Who is this?</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Text style={[styles.sectionTitle, {paddingHorizontal: layout.hPad, fontSize: layout.font.lg}]}>Your People</Text>

      <FlatList
        data={persons}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={loading && persons.length > 0} onRefresh={load} tintColor={COLORS.face} />
        }
        ListHeaderComponent={
          loading && persons.length === 0 ? <PersonListSkeleton count={4} /> : null
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="people-outline"
              title="No people yet"
              subtitle="Add someone to start finding their photos automatically"
              accentColor={COLORS.face}
            />
          ) : null
        }
        renderItem={({item}) => (
          <TouchableOpacity
            style={[styles.personCard, {marginHorizontal: layout.hPad}]}
            onPress={() =>
              navigation.navigate('PersonPhotos', {
                personId: item.id,
                personName: item.name,
              })
            }
            onLongPress={() => personActions(item)}>
            {item.imageUrl ? (
              <View style={styles.avatarRing}>
                <Image
                  source={{uri: api.getImageUrl(item.imageUrl)}}
                  style={[styles.avatar, {width: layout.thumbSize * 0.82, height: layout.thumbSize * 0.82, borderRadius: layout.thumbSize * 0.41}]}
                />
              </View>
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder, {width: layout.thumbSize * 0.82, height: layout.thumbSize * 0.82, borderRadius: layout.thumbSize * 0.41}]}>
                <Icon name="person" size={layout.thumbSize * 0.4} color={COLORS.textMuted} />
              </View>
            )}
            <View style={styles.personInfo}>
              <Text style={[styles.personName, {fontSize: layout.font.lg}]}>{item.name}</Text>
              {(item.photoCount ?? 0) > 0 ? (
                <Text style={styles.photoCount}>
                  {item.photoCount} photo{item.photoCount === 1 ? '' : 's'}
                </Text>
              ) : null}
              {item.registeredViews && item.registeredViews.length > 0 ? (
                <Text style={styles.viewTags} numberOfLines={1}>
                  AI views: {[...new Set(item.registeredViews)].join(' · ')}
                </Text>
              ) : null}
              {item.notes ? (
                <Text style={styles.personNotes} numberOfLines={2}>
                  {item.notes}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => personActions(item)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon name="ellipsis-horizontal" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        contentContainerStyle={
          persons.length === 0
            ? styles.emptyList
            : [styles.list, {paddingBottom: layout.contentBottomPadWithPlayer}]
        }
      />

      <Modal visible={!!editingPerson} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalCard, {maxWidth: layout.modalMaxWidth, alignSelf: 'center', width: '100%'}]}>
            <Text style={styles.modalTitle}>Edit person</Text>
            <Text style={styles.modalLabel}>Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Name"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              style={[styles.modalInput, styles.modalNotes]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Optional notes"
              placeholderTextColor={COLORS.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setEditingPerson(null)}
                disabled={savingEdit}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, savingEdit && styles.modalSaveDisabled]}
                onPress={saveEdit}
                disabled={savingEdit}>
                <Text style={styles.modalSaveText}>{savingEdit ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  hero: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusRow: {
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusOk: {
    borderColor: COLORS.success,
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
  },
  statusBad: {
    borderColor: COLORS.warning,
    backgroundColor: 'rgba(255, 176, 32, 0.12)',
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  heroActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroActionsStack: {
    flexDirection: 'column',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.face,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    ...SHADOW.sm,
  },
  primaryBtnText: {
    color: COLORS.background,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.face,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
  },
  secondaryBtnText: {
    color: COLORS.face,
    fontWeight: '700',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    letterSpacing: -0.2,
  },
  list: {},
  emptyList: {
    flexGrow: 1,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.sm,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.face,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.surfaceLight,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  personName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  photoCount: {
    color: COLORS.face,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  viewTags: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  personNotes: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: SPACING.md,
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  modalInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: SPACING.md,
  },
  modalNotes: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modalCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  modalSave: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.face,
    alignItems: 'center',
  },
  modalSaveDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: COLORS.background,
    fontWeight: '700',
  },
});
