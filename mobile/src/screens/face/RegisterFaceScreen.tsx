import React, {useState} from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {AppHeader} from '../../components/AppHeader';
import {api, FaceViewHint} from '../../api/client';
import {COLORS, SPACING} from '../../config';
import {FaceStackParamList} from '../../navigation/types';
import {useLayoutMetrics} from '../../utils/layout';
import {connectionErrorHint} from '../../utils/serverConnection';

type Props = NativeStackScreenProps<FaceStackParamList, 'RegisterFace'>;

const VIEW_OPTIONS: {id: FaceViewHint; label: string; icon: string}[] = [
  {id: 'AUTO', label: 'Auto AI', icon: 'sparkles-outline'},
  {id: 'FRONT', label: 'Front', icon: 'person-outline'},
  {id: 'LEFT', label: 'Left side', icon: 'arrow-back-outline'},
  {id: 'RIGHT', label: 'Right side', icon: 'arrow-forward-outline'},
  {id: 'PARTIAL', label: 'Partial', icon: 'scan-outline'},
];

function viewLabel(view?: string) {
  switch (view) {
    case 'FRONT':
      return 'Front';
    case 'LEFT':
      return 'Left side';
    case 'RIGHT':
      return 'Right side';
    case 'PARTIAL':
      return 'Partial';
    default:
      return 'Any angle';
  }
}

export function RegisterFaceScreen({navigation}: Props) {
  const layout = useLayoutMetrics(true);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [viewHint, setViewHint] = useState<FaceViewHint>('AUTO');
  const [savedViews, setSavedViews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleImageResult = (result: ImagePickerResponse) => {
    if (result.didCancel || !result.assets?.[0]?.uri) {
      return;
    }
    setImageUri(result.assets[0].uri);
  };

  const pickImage = () => {
    launchImageLibrary(
      {mediaType: 'photo', quality: 0.9, maxWidth: 1280, maxHeight: 1280},
      handleImageResult,
    );
  };

  const takePhoto = () => {
    launchCamera(
      {mediaType: 'photo', quality: 0.9, cameraType: 'front', maxWidth: 1280, maxHeight: 1280},
      handleImageResult,
    );
  };

  const submit = async (addAnother = false) => {
    if (!name.trim()) {
      Alert.alert('Required', 'Enter a name for this person');
      return;
    }
    if (!imageUri) {
      Alert.alert('Required', 'Select or capture a face photo');
      return;
    }

    setLoading(true);
    try {
      const response = await api.registerPerson(
        name.trim(),
        notes.trim(),
        imageUri,
        viewHint,
      );
      if (response.success && response.data) {
        const views = response.data.registeredViews || [];
        setSavedViews(views);
        setImageUri(null);
        setViewHint('AUTO');

        if (addAnother) {
          Alert.alert(
            'Angle saved',
            `AI saved ${viewLabel(response.data.lastRegisteredView)} view. Add front, left, and right for best matching.`,
          );
        } else {
          Alert.alert(
            'Profile ready',
            `${name} registered with ${views.length} face view${views.length === 1 ? '' : 's'}. Add more angles for side-face matching.`,
            [
              {
                text: 'Add another angle',
                onPress: () => {},
              },
              {text: 'Done', onPress: () => navigation.goBack()},
            ],
          );
        }
      } else {
        Alert.alert('Failed', response.message || 'Could not register face');
      }
    } catch {
      Alert.alert('Error', connectionErrorHint());
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader
        title="Add Person"
        subtitle="Register multiple angles for best AI matching"
        showBack
        accentColor={COLORS.face}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, {padding: layout.hPad, paddingBottom: layout.contentBottomPadWithPlayer}]}>
        <Text style={styles.label}>Person Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. John Doe"
          placeholderTextColor={COLORS.textMuted}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Relationship, role, etc."
          placeholderTextColor={COLORS.textMuted}
          multiline
        />

        <Text style={styles.label}>Face angle</Text>
        <View style={styles.viewRow}>
          {VIEW_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[styles.viewChip, viewHint === option.id && styles.viewChipActive]}
              onPress={() => setViewHint(option.id)}>
              <Icon
                name={option.icon}
                size={16}
                color={viewHint === option.id ? COLORS.background : COLORS.face}
              />
              <Text
                style={[
                  styles.viewChipText,
                  viewHint === option.id && styles.viewChipTextActive,
                ]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {savedViews.length > 0 ? (
          <View style={styles.savedViews}>
            <Text style={styles.savedTitle}>Saved AI views for {name}</Text>
            <View style={styles.savedRow}>
              {savedViews.map((view, index) => (
                <View key={`${view}-${index}`} style={styles.savedBadge}>
                  <Text style={styles.savedBadgeText}>{viewLabel(view)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>Photo</Text>
        <View style={styles.imageActions}>
          <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
            <Icon name="images-outline" size={22} color={COLORS.face} />
            <Text style={styles.imageBtnText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
            <Icon name="camera-outline" size={22} color={COLORS.face} />
            <Text style={styles.imageBtnText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {imageUri ? (
          <Image source={{uri: imageUri}} style={[styles.preview, {height: layout.mediaHeight * 0.6}]} resizeMode="cover" />
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitDisabled]}
          onPress={() => submit(false)}
          disabled={loading}>
          <Text style={styles.submitText}>
            {loading ? 'Saving AI profile...' : 'Save Face Profile'}
          </Text>
        </TouchableOpacity>

        {savedViews.length > 0 ? (
          <TouchableOpacity
            style={[styles.secondaryBtn, loading && styles.submitDisabled]}
            onPress={() => submit(true)}
            disabled={loading || !imageUri}>
            <Icon name="add-circle-outline" size={20} color={COLORS.face} />
            <Text style={styles.secondaryBtnText}>Save another angle</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {},
  hero: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  label: {
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {minHeight: 80, textAlignVertical: 'top'},
  viewRow: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm},
  viewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.face,
    backgroundColor: COLORS.surface,
  },
  viewChipActive: {backgroundColor: COLORS.face},
  viewChipText: {color: COLORS.face, fontSize: 12, fontWeight: '600'},
  viewChipTextActive: {color: COLORS.background},
  savedViews: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  savedTitle: {color: COLORS.textSecondary, fontSize: 13, marginBottom: SPACING.sm},
  savedRow: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs},
  savedBadge: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  savedBadgeText: {color: COLORS.face, fontWeight: '700', fontSize: 12},
  imageActions: {flexDirection: 'row', gap: SPACING.sm},
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.face,
    backgroundColor: COLORS.surface,
  },
  imageBtnText: {color: COLORS.face, fontWeight: '600'},
  preview: {
    width: '100%',
    borderRadius: 16,
    marginTop: SPACING.md,
    backgroundColor: COLORS.surfaceLight,
  },
  submitBtn: {
    backgroundColor: COLORS.face,
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  submitDisabled: {opacity: 0.6},
  submitText: {color: COLORS.background, fontWeight: '800', fontSize: 16},
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.face,
  },
  secondaryBtnText: {color: COLORS.face, fontWeight: '700'},
});
