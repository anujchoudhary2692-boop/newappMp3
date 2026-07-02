import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {discoverServer} from '../api/client';
import {
  COLORS,
  getApiBaseUrl,
  getServerCandidates,
  isProductionMode,
  RADIUS,
  SPACING,
} from '../config';

type GateStatus = 'checking' | 'ok' | 'fail';

export function BackendGate({children}: {children: React.ReactNode}) {
  const [status, setStatus] = useState<GateStatus>('checking');
  const [error, setError] = useState('');
  const [triedUrls, setTriedUrls] = useState<string[]>([]);
  const production = isProductionMode();

  const check = useCallback(async () => {
    setStatus('checking');
    setError('');
    const candidates = getServerCandidates();
    setTriedUrls(candidates.length > 0 ? candidates : [getApiBaseUrl()]);

    const found = await discoverServer(candidates);
    if (found) {
      setStatus('ok');
      return;
    }

    setStatus('fail');
    setError(
      production
        ? 'Cannot reach production server. Check URL and API key in production.config.ts'
        : `Tried ${candidates.length} addresses. Start backend: cd backend && mvn spring-boot:run`,
    );
  }, [production]);

  useEffect(() => {
    check();
  }, [check]);

  if (status === 'checking') {
    return (
      <View style={styles.screen}>
        <View style={styles.logoCircle}>
          <Icon name="play-circle" size={42} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>MediaFace</Text>
        <Text style={styles.tagline}>
          {production ? 'Connecting to Render (may take ~1 min on first load)…' : 'Finding your Mac on Wi‑Fi…'}
        </Text>
        <ActivityIndicator color={COLORS.primary} style={styles.spinner} />
        <Text style={styles.host}>{triedUrls.join('\n')}</Text>
      </View>
    );
  }

  if (status === 'fail') {
    return (
      <View style={styles.screen}>
        <View style={[styles.logoCircle, styles.logoWarn]}>
          <Icon name="cloud-offline-outline" size={42} color={COLORS.warning} />
        </View>
        <Text style={styles.appName}>Server unreachable</Text>
        <Text style={styles.tagline}>
          {production
            ? '1. Verify PRODUCTION_API_URL\n2. Match PRODUCTION_API_KEY with server\n3. Server must use HTTPS'
            : '1. Run backend on Mac\n2. Same Wi‑Fi as phone\n3. Settings → Local Network ON'}
        </Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorHost}>Checked:</Text>
          {triedUrls.map(url => (
            <Text key={url} style={styles.errorText}>
              {url}
            </Text>
          ))}
          {error ? <Text style={styles.errorDetail}>{error}</Text> : null}
        </View>
        <TouchableOpacity style={styles.retryBtn} onPress={check}>
          <Icon name="refresh" size={18} color={COLORS.background} />
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  logoWarn: {
    backgroundColor: 'rgba(255, 176, 32, 0.12)',
    borderColor: COLORS.warning,
  },
  appName: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tagline: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
    maxWidth: 320,
  },
  spinner: {
    marginTop: SPACING.xl,
  },
  host: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: SPACING.lg,
    textAlign: 'center',
    lineHeight: 16,
  },
  errorBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    maxWidth: 340,
    gap: SPACING.xs,
  },
  errorHost: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  errorDetail: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  retryText: {
    color: COLORS.background,
    fontWeight: '800',
    fontSize: 16,
  },
});
