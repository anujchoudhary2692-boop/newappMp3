import React, {useCallback, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {EnterpriseHeader} from '../components/enterprise/EnterpriseHeader';
import {useTheme} from '../context/ThemeContext';
import {api, discoverServer, HealthResponse, MediaDiagnostics} from '../api/client';
import {RADIUS, SHADOW, SPACING} from '../config';
import {ENTERPRISE, enterpriseStyles} from '../theme/enterprise';
import {clearCachedApiUrl} from '../utils/serverConnection';
import {THEME_LIST, ThemeId} from '../theme/themes';
import {openGuide, goToCameraTab, goToFacesTab, goToMediaTab} from '../navigation/navigationRef';
import {useLayoutMetrics} from '../utils/layout';
import {useFeatureFlags} from '../core/features/FeatureFlagsProvider';
import {formatBytes, getLocalStorageStats} from '../utils/localMediaStore';
import {
  isFaceAlertsEnabled,
  setFaceAlertsEnabled,
} from '../utils/faceAlerts';
import {
  isOfflineFacePreScanEnabled,
  setOfflineFacePreScanEnabled,
} from '../utils/localFaceDetect';
import {getAuthUser, clearAuthSession, setAuthSession, StoredAuthUser} from '../utils/authStorage';
import {httpRequest} from '../core/api/httpClient';

export function SettingsScreen() {
  const layout = useLayoutMetrics(false);
  const navigation = useNavigation();
  const {themeId, setThemeId, colors} = useTheme();
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [media, setMedia] = useState<MediaDiagnostics | null>(null);
  const [deviceStorage, setDeviceStorage] = useState<{fileCount: number; totalBytes: number} | null>(null);
  const {flags: featureFlags, loaded: featuresLoaded} = useFeatureFlags();
  const [retrying, setRetrying] = useState(false);
  const [faceAlerts, setFaceAlerts] = useState(true);
  const [offlineScan, setOfflineScan] = useState(true);
  const [authUser, setAuthUser] = useState<StoredAuthUser | null>(null);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const featureLabels: Record<string, string> = {
    mediaSearch: 'Media search',
    mediaDownload: 'Media download',
    mediaOfflineCache: 'Offline cache',
    faceAi: 'Face AI',
    faceLibraryScan: 'Face library scan',
    cameraCapture: 'Camera capture',
    cameraGeotag: 'Camera geotag',
    deviceStorage: 'Device storage',
  };

  const refreshServer = useCallback(async (clearCache = false) => {
    setServerOk(null);
    setHealth(null);
    setMedia(null);
    setDeviceStorage(null);
    if (clearCache) {
      await clearCachedApiUrl();
    }
    const found = await discoverServer();
    if (found) {
      try {
        const r = await api.health();
        setServerOk(r.success);
        if (r.data) {
          setHealth(r.data);
          setMedia(r.data.media ?? null);
        }
        try {
          setDeviceStorage(await getLocalStorageStats());
        } catch {
          // ignore
        }
        return;
      } catch {
        // fall through
      }
    }
    setServerOk(false);
    try {
      const stats = await getLocalStorageStats();
      setDeviceStorage(stats);
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshServer();
      void isFaceAlertsEnabled().then(setFaceAlerts);
      void isOfflineFacePreScanEnabled().then(setOfflineScan);
      void getAuthUser().then(setAuthUser);
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
    <View style={enterpriseStyles.page}>
      <EnterpriseHeader
        title="Your Account"
        subtitle="Settings & preferences"
        showBack
        onBack={() => navigation.goBack()}
        showSettings={false}
      />

      <ScrollView
        contentContainerStyle={[styles.content, {padding: layout.hPad, paddingBottom: layout.contentBottomPad}]}
        showsVerticalScrollIndicator={false}>
        {/* Connection */}
        <Text style={[styles.sectionTitle, {color: '#fff'}]}>Connection</Text>
        <View style={styles.statusCard}>
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

        {serverOk && media ? (
          <>
            <Text style={[styles.sectionTitle, {color: '#fff'}]}>Media engine</Text>
            <View style={styles.statusCard}>
              <MediaStatusRow
                label="Play & download"
                value={media.playDownload}
                ok={media.playDownload === 'UP'}
                warn={media.playDownload === 'LIMITED'}
              />
              <MediaStatusRow
                label="yt-dlp"
                value={media.ytDlpVersion ? `${media.ytDlp} · ${media.ytDlpVersion}` : media.ytDlp}
                ok={media.ytDlp === 'UP'}
              />
              <MediaStatusRow
                label="YouTube cookies"
                value={media.youtubeCookies === 'CONFIGURED' ? 'Configured' : 'Missing on server'}
                ok={media.youtubeCookies === 'CONFIGURED'}
                warn={media.youtubeCookies === 'MISSING'}
              />
              {health?.mediaStatus === 'DEGRADED' ? (
                <Text style={[styles.statusHint, {color: colors.textMuted}]}>
                  Search works. For play/download on cloud without your Mac, set YOUTUBE_COOKIES_BASE64 on Render — or use Mac backend on the same Wi‑Fi.
                </Text>
              ) : null}
              {media.hints?.cloud ? (
                <Text style={[styles.statusHint, {color: colors.textMuted}]}>{media.hints.cloud}</Text>
              ) : null}
            </View>
          </>
        ) : null}

        {deviceStorage ? (
          <>
            <Text style={[styles.sectionTitle, {color: '#fff'}]}>Device storage</Text>
            <View style={styles.statusCard}>
              <MediaStatusRow
                label="Saved on phone"
                value={`${deviceStorage.fileCount} files · ${formatBytes(deviceStorage.totalBytes)}`}
                ok={deviceStorage.fileCount > 0}
                warn={deviceStorage.fileCount === 0}
              />
              <Text style={[styles.statusHint, {color: colors.textMuted}]}>
                Downloads are stored in app internal storage for offline playback without internet.
              </Text>
            </View>
          </>
        ) : null}

        {featuresLoaded ? (
          <>
            <Text style={[styles.sectionTitle, {color: '#fff'}]}>Platform features</Text>
            <View style={styles.statusCard}>
              {Object.entries(featureFlags).map(([key, enabled]) => (
                <MediaStatusRow
                  key={key}
                  label={featureLabels[key] || key}
                  value={enabled ? 'Enabled' : 'Disabled'}
                  ok={enabled}
                  warn={!enabled}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Face tracing */}
        <Text style={[styles.sectionTitle, {color: colors.text, marginTop: SPACING.lg}]}>Face tracing</Text>
        <TouchableOpacity
          style={[styles.toggleRow, {borderColor: colors.border}]}
          onPress={() => {
            const next = !faceAlerts;
            setFaceAlerts(next);
            void setFaceAlertsEnabled(next);
          }}>
          <Text style={{color: colors.text, flex: 1}}>Sighting alerts (vibrate + popup)</Text>
          <Text style={{color: faceAlerts ? colors.face : colors.textMuted, fontWeight: '700'}}>
            {faceAlerts ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleRow, {borderColor: colors.border}]}
          onPress={() => {
            const next = !offlineScan;
            setOfflineScan(next);
            void setOfflineFacePreScanEnabled(next);
          }}>
          <Text style={{color: colors.text, flex: 1}}>Offline face pre-scan (ML Kit)</Text>
          <Text style={{color: offlineScan ? colors.face : colors.textMuted, fontWeight: '700'}}>
            {offlineScan ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, {color: colors.text, marginTop: SPACING.lg}]}>Enterprise auth</Text>
        {authUser ? (
          <View style={[styles.toggleRow, {borderColor: colors.border}]}>
            <Text style={{color: colors.text, flex: 1}}>
              {authUser.username} ({authUser.role})
            </Text>
            <TouchableOpacity
              onPress={() => {
                void clearAuthSession();
                setAuthUser(null);
              }}>
              <Text style={{color: colors.primary, fontWeight: '700'}}>Sign out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{gap: 8}}>
            <TextInput
              value={loginUser}
              onChangeText={setLoginUser}
              placeholder="Username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={[styles.input, {borderColor: colors.border, color: colors.text}]}
            />
            <TextInput
              value={loginPass}
              onChangeText={setLoginPass}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={[styles.input, {borderColor: colors.border, color: colors.text}]}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, {backgroundColor: colors.primary}]}
              onPress={() => {
                void (async () => {
                  try {
                    const res = await httpRequest<{token: string; user: StoredAuthUser}>(
                      '/api/auth/login',
                      {
                        method: 'POST',
                        body: JSON.stringify({username: loginUser, password: loginPass}),
                      },
                    );
                    if (!res.success || !res.data) {
                      Alert.alert('Login failed', res.message || 'Invalid credentials');
                      return;
                    }
                    await setAuthSession(res.data.token, res.data.user);
                    setAuthUser(res.data.user);
                    setLoginPass('');
                    const {migrateAndSyncCloudLibrary} = await import('../utils/librarySync');
                    await migrateAndSyncCloudLibrary();
                  } catch (e) {
                    Alert.alert('Login failed', e instanceof Error ? e.message : 'Error');
                  }
                })();
              }}>
              <Text style={{color: '#fff', fontWeight: '700', textAlign: 'center'}}>Sign in</Text>
            </TouchableOpacity>
          </View>
        )}

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
    </View>
  );
}

function MediaStatusRow({
  label,
  value,
  ok,
  warn,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  const icon = ok ? 'checkmark-circle' : warn ? 'warning' : 'close-circle';
  const color = ok ? '#2ECC71' : warn ? '#FF9900' : '#E74C3C';
  return (
    <View style={styles.mediaRow}>
      <Icon name={icon} size={18} color={color} />
      <View style={styles.mediaRowText}>
        <Text style={styles.mediaRowLabel}>{label}</Text>
        <Text style={styles.mediaRowValue}>{value}</Text>
      </View>
    </View>
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
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 1,
    backgroundColor: ENTERPRISE.cardBg,
    borderColor: ENTERPRISE.cardBorder,
    marginBottom: SPACING.lg,
    ...SHADOW.sm,
  },
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.md},
  statusText: {flex: 1, minWidth: 0},
  statusTitle: {fontWeight: '700', fontSize: 15},
  statusUrl: {fontSize: 12, fontWeight: '600', marginTop: 2},
  statusHint: {fontSize: 12, fontWeight: '600', marginTop: SPACING.sm, lineHeight: 18},
  mediaRow: {flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.sm},
  mediaRowText: {flex: 1, minWidth: 0},
  mediaRowLabel: {color: '#fff', fontWeight: '700', fontSize: 13},
  mediaRowValue: {color: '#9CA3AF', fontWeight: '600', fontSize: 12, marginTop: 2},
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
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 1,
    backgroundColor: ENTERPRISE.searchBg,
    borderColor: ENTERPRISE.searchBorder,
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
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 2,
    backgroundColor: ENTERPRISE.cardBg,
    borderColor: ENTERPRISE.cardBorder,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 1,
    backgroundColor: ENTERPRISE.cardBg,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: ENTERPRISE.radius.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: ENTERPRISE.cardBg,
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: ENTERPRISE.radius.md,
  },
});
