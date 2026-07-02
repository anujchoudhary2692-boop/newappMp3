import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
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
        ? 'Cloud server did not respond in time. Free Render tier sleeps — tap Try again and wait up to 2 minutes.'
        : 'Could not reach cloud or your Mac. Mac can be off if cloud works.',
    );
  }, [production]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active' && status === 'fail') {
        check();
      }
    });
    return () => sub.remove();
  }, [status, check]);

  if (status === 'checking') {
    return (
      <View style={styles.screen}>
        <View style={styles.logoCircle}>
          <Icon name="cloud" size={42} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>MediaFace</Text>
        <Text style={styles.tagline}>
          {production
            ? 'Connecting to cloud…\nYour Mac can be off — first load may take up to 2 min'
            : 'Trying cloud first, then your Mac on Wi‑Fi…'}
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
        <Text style={styles.appName}>Cannot connect</Text>
        <Text style={styles.tagline}>
          {production
            ? '1. Mac does NOT need to be on\n2. Free Render sleeps — tap Try again, wait ~2 min\n3. Need internet (Wi‑Fi or mobile data)'
            : '1. Cloud works without Mac\n2. For local Mac: same Wi‑Fi + backend running\n3. Settings → Local Network ON'}
        </Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorHost}>Tried:</Text>
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
