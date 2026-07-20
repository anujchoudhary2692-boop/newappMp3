import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {AppHeader} from '../components/AppHeader';
import {COLORS, RADIUS, SPACING} from '../config';
import {useTheme} from '../context/ThemeContext';
import {
  goToCameraTab,
  goToFacesTab,
  goToMediaTab,
} from '../navigation/navigationRef';
import {useLayoutMetrics} from '../utils/layout';

const SECTIONS = [
  {
    icon: 'play-circle',
    colorKey: 'primary' as const,
    title: 'Media Player',
    items: [
      'Search any song, artist, or music video from the web',
      'Stream audio or HD video instantly — no download needed',
      'Save MP3 to Music library or HD video to Videos library',
      'Full player: seek, speed (0.75×–2×), queue, repeat, mini-player',
    ],
    action: () => goToMediaTab('SearchTab'),
    actionLabel: 'Open Media',
  },
  {
    icon: 'camera',
    colorKey: 'camera' as const,
    title: 'Geo Camera',
    items: [
      'Take photos or record video (up to 60 seconds) with sound',
      'Automatic GPS geotag + city/country on every capture',
      'Saves to phone gallery and uploads to your Mac backend',
      'Geo Gallery: filter by photos, videos, or location-tagged',
    ],
    action: goToCameraTab,
    actionLabel: 'Open Camera',
  },
  {
    icon: 'scan-circle',
    colorKey: 'face' as const,
    title: 'Face Recognition',
    items: [
      'Register people with name, photo, and view hints',
      'Identify someone from a camera or gallery photo',
      'Scan your entire photo library for matches',
      'Works in group photos and video frames (like Google Photos)',
    ],
    action: goToFacesTab,
    actionLabel: 'Open Faces',
  },
  {
    icon: 'settings',
    colorKey: 'accent' as const,
    title: 'Setup & Tips',
    items: [
      'Backend must run on your Mac (same Wi‑Fi as phone)',
      'Start: docker compose up → mvn spring-boot:run → npm start',
      'Set LAN IP in mobile/src/local.config.ts for physical device',
      'Pick a theme in Settings — 5 color presets available',
    ],
    action: undefined,
    actionLabel: undefined,
  },
];

export function GuideScreen() {
  const layout = useLayoutMetrics(false);
  const navigation = useNavigation();
  const {colors, gradients} = useTheme();

  return (
    <LinearGradient colors={gradients.media} style={styles.root}>
      <AppHeader
        title="Feature Guide"
        subtitle="Everything MediaFace can do"
        showBack
        onBack={() => navigation.goBack()}
        accentColor={colors.primary}
      />

      <ScrollView
        contentContainerStyle={[styles.content, {padding: layout.hPad, paddingBottom: layout.contentBottomPadWithPlayer}]}
        showsVerticalScrollIndicator={false}>
        {SECTIONS.map(section => {
          const accent = colors[section.colorKey];
          const sectionIcon = layout.actionCircle;
          return (
            <View key={section.title} style={[styles.section, {padding: layout.isCompact ? SPACING.md : SPACING.lg}]}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, {backgroundColor: `${accent}25`, width: sectionIcon, height: sectionIcon, borderRadius: sectionIcon / 2}]}>
                  <Icon name={section.icon} size={layout.isCompact ? 18 : 22} color={accent} />
                </View>
                <Text style={[styles.sectionTitle, {fontSize: layout.font.lg}]}>{section.title}</Text>
              </View>
              {section.items.map(item => (
                <View key={item} style={styles.bulletRow}>
                  <Icon name="checkmark-circle" size={layout.font.md} color={accent} />
                  <Text style={[styles.bulletText, {fontSize: layout.font.md, lineHeight: layout.font.lineMd}]}>{item}</Text>
                </View>
              ))}
              {section.action && section.actionLabel ? (
                <Text style={[styles.link, {color: accent, fontSize: layout.font.sm}]} onPress={section.action}>
                  {section.actionLabel} →
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {gap: SPACING.md},
  section: {
    backgroundColor: 'rgba(26,26,36,0.85)',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: '800',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  bulletText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  link: {
    marginTop: SPACING.sm,
    fontWeight: '800',
  },
});
