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
import {AppLogo} from './AppLogo';
import {ensureApiServer} from '../core/api/httpClient';
import {
  COLORS,
  getApiBaseUrl,
  isProductionMode,
  RADIUS,
  SPACING,
} from '../config';

import {useLayoutMetrics} from '../utils/layout';

type GateStatus = 'checking' | 'ok' | 'fail';

export function BackendGate({children}: {children: React.ReactNode}) {
  const layout = useLayoutMetrics(false);
  const [status, setStatus] = useState<GateStatus>('checking');
  const [error, setError] = useState('');
  const [triedUrls, setTriedUrls] = useState<string[]>([]);
  const production = isProductionMode();

  const check = useCallback(async () => {
    setStatus('checking');
    setError('');
    setTriedUrls([getApiBaseUrl()]);

    try {
      const found = await ensureApiServer();
      if (found) {
        setTriedUrls([found]);
        setStatus('ok');
        return;
      }
    } catch {
      // fall through
    }

    setStatus('fail');
    setError(
      production
        ? 'Cloud server did not respond in time. Free Render tier sleeps — tap Try again and wait up to 3 minutes.'
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
      <View style={[styles.screen, {padding: layout.hPad, backgroundColor: '#0F1117'}]}>
        <AppLogo
          size={layout.emptyIcon}
          variant="splash"
          style={styles.splashLogo}
        />
        <Text style={[styles.tagline, {fontSize: layout.font.md, lineHeight: layout.font.lineMd, maxWidth: layout.contentW}]}>
          {production
            ? 'Getting things ready…'
            : 'Connecting to your library…'}
        </Text>
        <ActivityIndicator color="#FF9900" style={styles.spinner} />
        <Text style={[styles.host, {fontSize: layout.font.xs}]}>{triedUrls.join('\n')}</Text>
      </View>
    );
  }

  if (status === 'fail') {
    return (
      <View style={[styles.screen, {padding: layout.hPad}]}>
        <View style={[styles.logoCircle, styles.logoWarn, {width: layout.emptyIcon, height: layout.emptyIcon, borderRadius: layout.emptyIcon / 2}]}>
          <Icon name="cloud-offline-outline" size={layout.emptyIcon * 0.48} color={COLORS.warning} />
        </View>
        <Text style={[styles.appName, {fontSize: layout.font.hero * 0.4}]}>Cannot connect</Text>
        <Text style={[styles.tagline, {fontSize: layout.font.md, lineHeight: layout.font.lineMd, maxWidth: layout.contentW}]}>
          {production
            ? 'Check your internet and try again.\nFirst open can take a minute.'
            : 'Start the app backend on your Mac, or use cloud mode.'}
        </Text>
        <View style={[styles.errorBox, {maxWidth: layout.contentW}]}>
          <Text style={styles.errorHost}>Tried:</Text>
          {triedUrls.map(url => (
            <Text key={url} style={[styles.errorText, {fontSize: layout.font.xs}]}>
              {url}
            </Text>
          ))}
          {error ? <Text style={[styles.errorDetail, {fontSize: layout.font.sm}]}>{error}</Text> : null}
        </View>
        <TouchableOpacity style={styles.retryBtn} onPress={check}>
          <Icon name="refresh" size={18} color={COLORS.background} />
          <Text style={[styles.retryText, {fontSize: layout.font.md}]}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F1117',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  splashLogo: {
    marginBottom: SPACING.lg,
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
