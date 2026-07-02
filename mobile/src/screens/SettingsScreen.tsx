import React, {useCallback, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {AppHeader} from '../components/AppHeader';
import {useTheme} from '../context/ThemeContext';
import {api, discoverServer} from '../api/client';
import {RADIUS, SHADOW, SPACING} from '../config';
import {clearCachedApiUrl} from '../utils/serverConnection';
import {THEME_LIST, ThemeId} from '../theme/themes';
import {openGuide, goToCameraTab, goToFacesTab, goToMediaTab} from '../navigation/navigationRef';
import {useLayoutMetrics} from '../utils/layout';

export function SettingsScreen() {
  const layout = useLayoutMetrics(false);
  const navigation = useNavigation();
  const {themeId, setThemeId, colors, gradients} = useTheme();
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);

  const refreshServer = useCallback(async (clearCache = false) => {
    setServerOk(null);
    if (clearCache) {
      await clearCachedApiUrl();
    }
    const found = await discoverServer();
    if (found) {
      try {
        const r = await api.health();
        setServerOk(r.success);
        return;
      } catch {
        // fall through
      }
    }
    setServerOk(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshServer();
    }, [refreshServer]),
  );

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshServer(true);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <LinearGradient colors={gradients.media} style={styles.root}>
      <AppHeader
        title="Settings"
        showBack
        onBack={() => navigation.goBack()}
        accentColor={colors.primary}
        variant="minimal"
      />

      <ScrollView
        contentContainerStyle={[styles.content, {padding: layout.hPad, paddingBottom: layout.contentBottomPad}]}
        showsVerticalScrollIndicator={false}>
        {/* Connection */}
        <Text style={[styles.sectionTitle, {color: colors.text}]}>Connection</Text>
        <View style={[styles.statusCard, {borderColor: colors.border}]}>
          <View style={styles.statusRow}>
            <Icon
              name={serverOk ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={serverOk ? colors.success : colors.warning}
            />
            <View style={styles.statusText}>
              <Text style={[styles.statusTitle, {color: colors.text}]}>
                {serverOk === null
                  ? 'Checking…'
                  : serverOk
                    ? 'Connected'
                    : 'Offline'}
              </Text>
              {!serverOk ? (
                <Text style={[styles.statusUrl, {color: colors.textMuted}]}>
                  Pull down on Home to refresh, or tap retry below.
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.retryBtn, {borderColor: colors.primary}]}
            onPress={handleRetry}
            disabled={retrying}>
            <Icon name="refresh" size={16} color={colors.primary} />
            <Text style={[styles.retryLabel, {color: colors.primary}]}>
              {retrying ? 'Connecting…' : 'Retry connection'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Shortcuts */}
        <Text style={[styles.sectionTitle, {color: colors.text, marginTop: SPACING.lg}]}>Shortcuts</Text>
        <View style={styles.linkGrid}>
          <LinkChip icon="search" label="Search" color={colors.primary} onPress={() => goToMediaTab('SearchTab')} />
          <LinkChip icon="musical-notes" label="Music" color={colors.audio} onPress={() => goToMediaTab('AudioTab')} />
          <LinkChip icon="videocam" label="Videos" color={colors.video} onPress={() => goToMediaTab('VideoTab')} />
          <LinkChip icon="camera" label="Camera" color={colors.camera} onPress={goToCameraTab} />
          <LinkChip icon="scan" label="Faces" color={colors.face} onPress={goToFacesTab} />
          <LinkChip icon="book" label="Guide" color={colors.accent} onPress={openGuide} />
        </View>

        <Text style={[styles.sectionTitle, {color: colors.text, marginTop: SPACING.lg}]}>Appearance</Text>
        <Text style={[styles.sectionHint, {color: colors.textMuted}]}>
          Pick a vibe for the whole app.
        </Text>

        <View style={[styles.themeGrid, layout.isTablet && styles.themeGridTablet]}>
          {THEME_LIST.map(theme => {
            const active = theme.id === themeId;
            return (
              <TouchableOpacity
                key={theme.id}
                style={[
                  styles.themeCard,
                  layout.isTablet && styles.themeCardTablet,
                  {borderColor: active ? theme.swatch : colors.border},
                  active && {backgroundColor: `${theme.swatch}18`},
                ]}
                activeOpacity={0.88}
                onPress={() => setThemeId(theme.id as ThemeId)}>
                <View style={[styles.swatch, {backgroundColor: theme.swatch, width: layout.actionCircle, height: layout.actionCircle, borderRadius: layout.actionCircle / 2}]}>
                  {active ? <Icon name="checkmark" size={18} color="#fff" /> : null}
                </View>
                <Text style={[styles.themeName, {color: colors.text, fontSize: layout.font.md}]}>{theme.name}</Text>
                <View style={styles.dots}>
                  {[theme.colors.primary, theme.colors.face, theme.colors.camera].map(c => (
                    <View key={c} style={[styles.dot, {backgroundColor: c}]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function LinkChip({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.linkChip, {borderColor: `${color}40`}]} onPress={onPress}>
      <Icon name={icon} size={18} color={color} />
      <Text style={styles.linkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {},
  statusCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(26,26,36,0.85)',
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md},
  statusText: {flex: 1, minWidth: 0},
  statusTitle: {fontWeight: '700', fontSize: 15},
  statusUrl: {fontSize: 12, fontWeight: '600', marginTop: 2},
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  retryLabel: {fontWeight: '700', fontSize: 14},
  sectionTitle: {fontSize: 17, fontWeight: '700', marginBottom: 4},
  sectionHint: {fontSize: 13, fontWeight: '600', marginBottom: SPACING.md},
  linkGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm},
  linkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: 'rgba(26,26,36,0.7)',
    minWidth: '30%',
    flexGrow: 1,
  },
  linkLabel: {color: '#fff', fontWeight: '700', fontSize: 13},
  themeGrid: {gap: SPACING.sm},
  themeGridTablet: {flexDirection: 'row', flexWrap: 'wrap'},
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    backgroundColor: 'rgba(26,26,36,0.85)',
    ...SHADOW.sm,
  },
  themeCardTablet: {
    width: '48%',
    flexGrow: 1,
  },
  swatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeName: {flex: 1, fontWeight: '700'},
  dots: {flexDirection: 'row', gap: 6},
  dot: {width: 10, height: 10, borderRadius: 5},
});
