import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, RADIUS, SHADOW, SPACING} from '../config';
import {ENTERPRISE} from '../theme/enterprise';
import {useLayoutMetrics} from '../utils/layout';

interface MediaCardProps {
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  audioFormat?: string;
  videoFormat?: string;
  onPlayAudio?: () => void;
  onPlayVideo?: () => void;
  onPlay?: () => void;
  onDownloadAudio?: () => void;
  onDownloadVideo?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
  onPressIn?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAddToPlaylist?: () => void;
  onPlayNext?: () => void;
  onAddToQueue?: () => void;
  batchSelect?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  downloading?: 'AUDIO' | 'VIDEO' | null;
  downloadProgress?: number | null;
  playing?: 'AUDIO' | 'VIDEO' | null;
  mode?: 'search' | 'library';
  type?: 'AUDIO' | 'VIDEO';
  active?: boolean;
}

function formatDuration(seconds?: number) {
  if (!seconds) {
    return '';
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaCard({
  title,
  subtitle,
  thumbnailUrl,
  audioFormat,
  videoFormat,
  onPlayAudio,
  onPlayVideo,
  onPlay,
  onDownloadAudio,
  onDownloadVideo,
  onDelete,
  onPress,
  onPressIn,
  isFavorite,
  onToggleFavorite,
  onAddToPlaylist,
  onPlayNext,
  onAddToQueue,
  batchSelect,
  selected,
  onToggleSelect,
  downloading,
  downloadProgress,
  playing,
  mode = 'search',
  type,
  active = false,
}: MediaCardProps) {
  const layout = useLayoutMetrics(true);
  const accent = type === 'VIDEO' ? COLORS.video : COLORS.audio;
  const circle = layout.actionCircle;
  const iconSize = layout.isCompact ? 15 : 18;
  const showActionLabels = !layout.isSmallPhone;
  return (
    <View style={[styles.card, SHADOW.sm, {marginHorizontal: layout.hPad}, active && styles.cardActive, active && {borderColor: accent}]}>
      {active ? <View style={[styles.activeStrip, {backgroundColor: accent}]} /> : null}
      <TouchableOpacity
        style={[styles.main, {padding: layout.isCompact ? SPACING.sm : SPACING.md}]}
        onPress={onPress}
        onPressIn={onPressIn}
        activeOpacity={onPress ? 0.88 : 1}
        disabled={!onPress}>
        <View style={[styles.thumbWrap, type === 'VIDEO' ? styles.thumbVideo : styles.thumbAudio]}>
          <Image
            source={{uri: thumbnailUrl}}
            style={[styles.thumbnail, {width: layout.thumbSize, height: layout.thumbSize}]}
          />
          {mode === 'search' && onToggleFavorite ? (
            <TouchableOpacity style={styles.favBtn} onPress={onToggleFavorite} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? COLORS.danger : '#fff'}
              />
            </TouchableOpacity>
          ) : null}
          {mode === 'search' && onAddToPlaylist ? (
            <TouchableOpacity style={styles.plBtn} onPress={onAddToPlaylist} hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Icon name="add-circle-outline" size={18} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {mode === 'library' && (
            <View style={[styles.typeDot, {backgroundColor: accent}]}>
              <Icon name={type === 'VIDEO' ? 'videocam' : 'musical-notes'} size={10} color={COLORS.text} />
            </View>
          )}
        </View>
        <View style={[styles.info, {marginLeft: layout.isCompact ? SPACING.sm : SPACING.md}]}>
          <Text style={[styles.title, {fontSize: layout.font.md}]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, {fontSize: layout.font.sm}]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {mode === 'search' && (audioFormat || videoFormat) && (
            <View style={styles.formatRow}>
              {audioFormat ? (
                <View style={[styles.badge, styles.audioBadge]}>
                  <Icon name="musical-notes" size={11} color={COLORS.text} />
                  <Text style={styles.badgeText}>{audioFormat}</Text>
                </View>
              ) : null}
              {videoFormat ? (
                <View style={[styles.badge, styles.videoBadge]}>
                  <Icon name="videocam" size={11} color={COLORS.text} />
                  <Text style={styles.badgeText}>{videoFormat}</Text>
                </View>
              ) : null}
            </View>
          )}
          {type && mode === 'library' && (
            <View style={[styles.badge, type === 'AUDIO' ? styles.audioBadge : styles.videoBadge]}>
              <Text style={styles.badgeText}>{type === 'AUDIO' ? 'MP3' : 'HD'}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {mode === 'search' && batchSelect ? (
        <TouchableOpacity style={styles.batchSelectRow} onPress={onToggleSelect}>
          <Icon name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? COLORS.primary : COLORS.textMuted} />
          <Text style={styles.batchSelectText}>{selected ? 'Selected' : 'Select for batch download'}</Text>
        </TouchableOpacity>
      ) : null}

      {mode === 'search' && (
        <View style={[styles.iconActions, {paddingTop: layout.isCompact ? SPACING.sm : SPACING.md}]}>
          {downloading && downloadProgress != null && downloadProgress > 0 && downloadProgress < 100 ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${downloadProgress}%`,
                      backgroundColor: downloading === 'AUDIO' ? COLORS.audio : COLORS.video,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressLabel}>Saving {downloadProgress}%</Text>
            </View>
          ) : null}
          <TouchableOpacity style={styles.iconAction} onPress={onPlayAudio} disabled={!!playing}>
            {playing === 'AUDIO' ? (
              <ActivityIndicator color={COLORS.audio} size="small" />
            ) : (
              <>
                <View style={[styles.iconCircle, styles.audioCircle, {width: circle, height: circle, borderRadius: circle / 2}]}>
                  <Icon name="play" size={iconSize} color={COLORS.text} />
                </View>
                <Text style={[styles.iconLabel, {fontSize: layout.font.xs}, !showActionLabels && styles.iconLabelHidden]}>Audio</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconAction} onPress={onPlayVideo} disabled={!!playing}>
            {playing === 'VIDEO' ? (
              <ActivityIndicator color={COLORS.video} size="small" />
            ) : (
              <>
                <View style={[styles.iconCircle, styles.videoCircle, {width: circle, height: circle, borderRadius: circle / 2}]}>
                  <Icon name="play-circle" size={iconSize} color={COLORS.text} />
                </View>
                <Text style={[styles.iconLabel, {fontSize: layout.font.xs}, !showActionLabels && styles.iconLabelHidden]}>Video</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconAction} onPress={onDownloadAudio} disabled={!!downloading}>
            {downloading === 'AUDIO' ? (
              <ActivityIndicator color={COLORS.audio} size="small" />
            ) : (
              <>
                <View style={[styles.iconCircle, styles.audioOutlineCircle, {width: circle, height: circle, borderRadius: circle / 2}]}>
                  <Icon name="download-outline" size={iconSize} color={COLORS.audio} />
                </View>
                <Text style={[styles.iconLabel, {fontSize: layout.font.xs, color: COLORS.audio}, !showActionLabels && styles.iconLabelHidden]}>Save</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconAction} onPress={onDownloadVideo} disabled={!!downloading}>
            {downloading === 'VIDEO' ? (
              <ActivityIndicator color={COLORS.video} size="small" />
            ) : (
              <>
                <View style={[styles.iconCircle, styles.videoOutlineCircle, {width: circle, height: circle, borderRadius: circle / 2}]}>
                  <Icon name="download-outline" size={iconSize} color={COLORS.video} />
                </View>
                <Text style={[styles.iconLabel, {fontSize: layout.font.xs, color: COLORS.video}, !showActionLabels && styles.iconLabelHidden]}>HD</Text>
              </>
            )}
          </TouchableOpacity>
          {onPlayNext ? (
            <TouchableOpacity style={styles.iconAction} onPress={onPlayNext}>
              <View style={[styles.iconCircle, styles.audioOutlineCircle, {width: circle, height: circle, borderRadius: circle / 2}]}>
                <Icon name="play-skip-forward-outline" size={iconSize} color={COLORS.audio} />
              </View>
              <Text style={[styles.iconLabel, {fontSize: layout.font.xs}, !showActionLabels && styles.iconLabelHidden]}>Next</Text>
            </TouchableOpacity>
          ) : null}
          {onAddToQueue ? (
            <TouchableOpacity style={styles.iconAction} onPress={onAddToQueue}>
              <View style={[styles.iconCircle, styles.audioOutlineCircle, {width: circle, height: circle, borderRadius: circle / 2}]}>
                <Icon name="list-outline" size={iconSize} color={COLORS.text} />
              </View>
              <Text style={[styles.iconLabel, {fontSize: layout.font.xs}, !showActionLabels && styles.iconLabelHidden]}>Queue</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {mode === 'library' && (
        <View style={styles.libraryFooter}>
          <TouchableOpacity
            style={[styles.playLibraryBtn, active && {backgroundColor: accent}]}
            onPress={onPlay}
            activeOpacity={0.85}>
            <Icon name={active ? 'radio' : 'play'} size={16} color={COLORS.text} />
            <Text style={[styles.playLibraryText, {fontSize: layout.font.sm}]}>{active ? 'Now Playing' : 'Play'}</Text>
          </TouchableOpacity>
          {onDelete && (
            <TouchableOpacity style={styles.deleteLibraryBtn} onPress={onDelete}>
              <Icon name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export {formatDuration};

const styles = StyleSheet.create({
  card: {
    backgroundColor: ENTERPRISE.cardBg,
    borderRadius: ENTERPRISE.radius.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
  },
  cardActive: {
    backgroundColor: '#1A222D',
  },
  activeStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  main: {
    flexDirection: 'row',
    padding: SPACING.md,
    alignItems: 'center',
  },
  thumbWrap: {
    borderRadius: RADIUS.md,
    padding: 2,
  },
  thumbAudio: {
    backgroundColor: 'rgba(124, 92, 255, 0.35)',
  },
  thumbVideo: {
    backgroundColor: 'rgba(255, 107, 157, 0.35)',
  },
  thumbnail: {
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceLight,
  },
  typeDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  favBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plBtn: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtn: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnActive: {
    backgroundColor: 'rgba(255,153,0,0.35)',
  },
  info: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  subtitle: {
    color: '#879596',
    fontSize: 13,
    marginTop: 4,
  },
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  audioBadge: {
    backgroundColor: 'rgba(124, 92, 255, 0.25)',
  },
  videoBadge: {
    backgroundColor: 'rgba(255, 107, 157, 0.25)',
  },
  badgeText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: ENTERPRISE.divider,
  },
  progressWrap: {
    width: '100%',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surfaceLight,
    overflow: 'hidden',
  },
  progressFill: {height: '100%', borderRadius: 3},
  progressLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  iconAction: {alignItems: 'center', flex: 1, minWidth: 0},
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  audioCircle: {backgroundColor: ENTERPRISE.brand},
  videoCircle: {backgroundColor: COLORS.video},
  audioOutlineCircle: {
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.audio,
  },
  videoOutlineCircle: {
    backgroundColor: 'rgba(255, 107, 157, 0.15)',
    borderWidth: 1.5,
    borderColor: COLORS.video,
  },
  iconLabel: {color: COLORS.textSecondary, fontWeight: '700'},
  iconLabelHidden: {height: 0, opacity: 0, marginBottom: 0},
  batchSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  batchSelectText: {color: COLORS.textMuted, fontWeight: '600', fontSize: 12},
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  actionBtn: {
    flex: 1,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    minHeight: 54,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    minHeight: 54,
  },
  audioOutline: {
    borderColor: COLORS.audio,
    backgroundColor: 'rgba(124, 92, 255, 0.08)',
  },
  videoOutline: {
    borderColor: COLORS.video,
    backgroundColor: 'rgba(255, 107, 157, 0.08)',
  },
  actionText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },
  audioText: {
    color: COLORS.audio,
  },
  videoText: {
    color: COLORS.video,
  },
  libraryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  playLibraryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ENTERPRISE.brand,
    paddingVertical: 14,
    borderRadius: ENTERPRISE.radius.md,
    minHeight: 48,
  },
  playLibraryText: {
    color: '#111',
    fontWeight: '800',
    fontSize: 14,
  },
  deleteLibraryBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 92, 122, 0.1)',
  },
});
