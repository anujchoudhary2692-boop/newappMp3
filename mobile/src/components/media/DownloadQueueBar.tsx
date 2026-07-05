import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, RADIUS, SPACING} from '../../config';
import {ENTERPRISE} from '../../theme/enterprise';
import {
  clearCompletedDownloads,
  getDownloadQueue,
  getDownloadQueueStats,
  subscribeDownloadQueue,
  type DownloadJob,
} from '../../utils/downloadQueueStore';
import {useLayoutMetrics} from '../../utils/layout';

export function DownloadQueueBar() {
  const layout = useLayoutMetrics(true);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeDownloadQueue(() => setTick(n => n + 1)), []);

  const jobs = getDownloadQueue();
  const stats = getDownloadQueueStats();
  if (jobs.length === 0) {
    return null;
  }

  const active = jobs.find((j: DownloadJob) => j.status === 'active');
  const visible = stats.pending + stats.active + stats.failed > 0 || stats.done > 0;
  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.wrap, {marginHorizontal: layout.hPad, bottom: layout.contentBottomPadWithPlayer - 56}]}>
      <View style={styles.bar}>
        {active ? (
          <>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <View style={styles.meta}>
              <Text style={[styles.title, {fontSize: layout.font.sm}]} numberOfLines={1}>
                Saving {active.item.title}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, {width: `${active.progress}%`}]} />
              </View>
            </View>
            <Text style={[styles.pct, {fontSize: layout.font.xs}]}>{active.progress}%</Text>
          </>
        ) : (
          <>
            <Icon name="download-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.title, {fontSize: layout.font.sm, flex: 1}]}>
              {stats.pending} queued · {stats.done} done
              {stats.failed > 0 ? ` · ${stats.failed} failed` : ''}
            </Text>
          </>
        )}
        {stats.done > 0 ? (
          <TouchableOpacity onPress={clearCompletedDownloads} hitSlop={8}>
            <Icon name="checkmark-done" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 90,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: ENTERPRISE.cardBg,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  meta: {flex: 1, gap: 4},
  title: {color: COLORS.text, fontWeight: '700'},
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.surfaceLight,
    overflow: 'hidden',
  },
  fill: {height: '100%', backgroundColor: COLORS.primary, borderRadius: 2},
  pct: {color: COLORS.textMuted, fontWeight: '700', minWidth: 32, textAlign: 'right'},
});
