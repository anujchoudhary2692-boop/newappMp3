import React, {useState} from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {AppHeader} from '../../components/AppHeader';
import {FaceScanOverlay} from '../../components/FaceScanOverlay';
import {api, FaceIdentifyResult} from '../../api/client';
import {COLORS, SPACING} from '../../config';
import {FaceStackParamList} from '../../navigation/types';
import {useLayoutMetrics} from '../../utils/layout';
import {connectionErrorHint} from '../../utils/serverConnection';

type Nav = NativeStackNavigationProp<FaceStackParamList>;

export function IdentifyFaceScreen() {
  const layout = useLayoutMetrics(true);
  const navigation = useNavigation<Nav>();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<FaceIdentifyResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageResult = (pickerResult: ImagePickerResponse) => {
    if (pickerResult.didCancel || !pickerResult.assets?.[0]?.uri) return;
    setImageUri(pickerResult.assets[0].uri);
    setResult(null);
  };

  const identify = async () => {
    if (!imageUri) {
      Alert.alert('Required', 'Select or capture a photo first');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await api.identifyFace(imageUri);
      if (response.success) {
        setResult(response.data);
        if (response.data.matched && response.data.personName) {
          Alert.alert(
            'Match found',
            `${response.data.personName} (${Math.round(response.data.confidence)}% confidence)`,
          );
        }
      } else {
        Alert.alert('Failed', response.message || 'Identification failed');
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : connectionErrorHint());
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.flex}>
      <AppHeader
        title="Who is this?"
        subtitle="Front, side & partial faces supported"
        showBack
        accentColor={COLORS.face}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, {paddingBottom: layout.contentBottomPad}]}>
      <View style={[styles.actions, {paddingHorizontal: layout.hPad}]}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => launchImageLibrary({mediaType: 'photo', maxWidth: 1280, maxHeight: 1280}, handleImageResult)}>
          <Icon name="images" size={22} color={COLORS.face} />
          <Text style={styles.actionText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => launchCamera({mediaType: 'photo', cameraType: 'front', maxWidth: 1280, maxHeight: 1280}, handleImageResult)}>
          <Icon name="camera" size={22} color={COLORS.face} />
          <Text style={styles.actionText}>Camera</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.previewWrap, {marginHorizontal: layout.hPad, height: layout.mediaHeight * 0.72}]}>
        {imageUri ? (
          <Image source={{uri: imageUri}} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.previewPlaceholder}>
            <FaceScanOverlay label="Select a photo to scan" accent={COLORS.face} size={220} />
          </View>
        )}
        {imageUri && !loading ? (
          <View style={styles.scanFrame}>
            <FaceScanOverlay active={false} label="Ready to identify" accent={COLORS.face} size={200} />
          </View>
        ) : null}
        {loading && (
          <View style={styles.scanOverlay}>
            <FaceScanOverlay active label="AI scanning…" accent={COLORS.face} size={200} />
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.identifyBtn, (loading || !imageUri) && styles.identifyDisabled]}
        onPress={identify}
        disabled={loading || !imageUri}>
        <Icon name="scan" size={22} color={COLORS.background} />
        <Text style={styles.identifyText}>{loading ? 'Analyzing...' : 'Identify Person'}</Text>
      </TouchableOpacity>

      {result && (
        <LinearGradient
          colors={result.matched ? ['#0A3D32', '#0F0F14'] : ['#3D2A0A', '#0F0F14']}
          style={[styles.resultCard, result.matched ? styles.matchBorder : styles.noMatchBorder]}>
          <Icon
            name={result.matched ? 'checkmark-circle' : 'close-circle'}
            size={48}
            color={result.matched ? COLORS.success : COLORS.warning}
          />
          <Text style={styles.resultTitle}>
            {result.matched ? result.personName : 'Unknown Person'}
          </Text>
          <Text style={styles.resultSub}>
            {result.matched
              ? `${result.confidence}% match confidence`
              : `Closest match ${result.confidence}% — not sure enough`}
          </Text>
          {result.facesScanned != null && result.facesScanned > 1 ? (
            <Text style={styles.facesScanned}>
              Scanned {result.facesScanned} faces in photo
            </Text>
          ) : null}
          <View style={styles.confidenceBarBg}>
            <View style={[styles.confidenceBar, {
              width: `${Math.min(100, result.confidence)}%`,
              backgroundColor: result.matched ? COLORS.success : COLORS.warning,
            }]} />
          </View>
          {result.candidates && result.candidates.length > 0 ? (
            <View style={styles.candidates}>
              <Text style={styles.candidatesTitle}>Top matches</Text>
              {result.candidates.map((c, index) => (
                <View key={c.personId} style={styles.candidateRow}>
                  <Text style={styles.candidateRank}>{index + 1}.</Text>
                  <Text style={styles.candidateName}>{c.personName}</Text>
                  <Text style={styles.candidateScore}>{c.confidence}%</Text>
                </View>
              ))}
            </View>
          ) : null}
          {result.matched && result.personId ? (
            <TouchableOpacity
              style={styles.resultAction}
              onPress={() =>
                navigation.navigate('PersonPhotos', {
                  personId: result.personId!,
                  personName: result.personName || 'Person',
                })
              }>
              <Icon name="images" size={20} color={COLORS.background} />
              <Text style={styles.resultActionText}>View all photos</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.resultAction, styles.resultActionOutline]}
              onPress={() => navigation.navigate('RegisterFace')}>
              <Icon name="person-add" size={20} color={COLORS.face} />
              <Text style={[styles.resultActionText, {color: COLORS.face}]}>
                Register this person
              </Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: COLORS.background},
  container: {flex: 1, backgroundColor: COLORS.background},
  content: {},
  hero: {padding: SPACING.lg, alignItems: 'center', marginBottom: SPACING.md},
  heroTitle: {color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: SPACING.sm},
  heroSub: {color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.xs},
  actions: {flexDirection: 'row', gap: SPACING.sm},
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, padding: SPACING.md, borderRadius: 14,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.face,
  },
  actionText: {color: COLORS.face, fontWeight: '700'},
  previewWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  preview: {width: '100%', height: '100%'},
  previewPlaceholder: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  scanFrame: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanText: {color: COLORS.text, marginTop: SPACING.sm, fontWeight: '600'},
  identifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, marginHorizontal: SPACING.md,
    backgroundColor: COLORS.face, borderRadius: 16, padding: SPACING.md,
  },
  identifyDisabled: {opacity: 0.5},
  identifyText: {color: COLORS.background, fontWeight: '800', fontSize: 16},
  resultCard: {
    margin: SPACING.md, padding: SPACING.lg, borderRadius: 20,
    alignItems: 'center', borderWidth: 1,
  },
  matchBorder: {borderColor: COLORS.success},
  noMatchBorder: {borderColor: COLORS.warning},
  resultTitle: {color: COLORS.text, fontSize: 24, fontWeight: '800', marginTop: SPACING.sm},
  resultSub: {color: COLORS.textSecondary, marginTop: SPACING.xs, fontSize: 14, textAlign: 'center'},
  facesScanned: {color: COLORS.textMuted, marginTop: SPACING.xs, fontSize: 12},
  confidenceBarBg: {
    width: '100%', height: 8, borderRadius: 4,
    backgroundColor: COLORS.surfaceLight, marginTop: SPACING.lg, overflow: 'hidden',
  },
  confidenceBar: {height: '100%', borderRadius: 4},
  candidates: {
    width: '100%',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  candidatesTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  candidateRank: {color: COLORS.textMuted, width: 24, fontWeight: '700'},
  candidateName: {flex: 1, color: COLORS.text, fontWeight: '600'},
  candidateScore: {color: COLORS.face, fontWeight: '700'},
  resultAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.face,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 14,
    width: '100%',
  },
  resultActionOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.face,
  },
  resultActionText: {color: COLORS.background, fontWeight: '800', fontSize: 15},
});
