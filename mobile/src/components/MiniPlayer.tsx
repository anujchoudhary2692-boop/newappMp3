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
import LinearGradient from 'react-native-linear-gradient';
import {usePlayback} from '../context/PlaybackContext';
import {COLORS, RADIUS, SHADOW, SPACING} from '../config';
import {ENTERPRISE} from '../theme/enterprise';
import {isPlayerScreenOpen, openPlayerScreen, shouldHideMiniPlayer} from '../navigation/navigationRef';
import {useLayoutMetrics} from '../utils/layout';
import {SeekableProgressBar} from './SeekableProgressBar';

interface MiniPlayerProps {
  routeVersion: number;
}

export function MiniPlayer({routeVersion}: MiniPlayerProps) {
  const layout = useLayoutMetrics(true);
  const playerOpen = isPlayerScreenOpen();
  const {
    media,
    streamUrl,
    paused,
    currentTime,
    duration,
    buffering,
    queueIndex,
    queueLength,
    hasNext,
    hasPrevious,
    playNext,
    playPrevious,
    togglePause,
    seekTo,
    stop,
  } = usePlayback();

  if (!media || !streamUrl || playerOpen || shouldHideMiniPlayer()) {
    return null;
  }

  // Keep mini-player in sync when navigation changes
  if (routeVersion < 0) {
    return null;
  }

  const progress = duration > 0 ? currentTime / duration : 0;
  const accent = media.type === 'VIDEO' ? COLORS.video : COLORS.audio;
  const queueActive = queueLength > 1;
  const thumb = layout.miniThumb;
  const playBtn = layout.miniPlayBtn;
  const iconBtn = layout.miniIconBtn;

  const handlePrevious = () => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    playPrevious();
  };

  return (
    <View style={[styles.wrap, {bottom: layout.miniPlayerBottom, left: layout.hPad, right: layout.hPad}]}>
      <View style={[styles.bar, SHADOW.md]}>
        <View style={[styles.accentEdge, {backgroundColor: ENTERPRISE.brand}]} />
        {queueActive ? (
          <TouchableOpacity
            style={[styles.iconBtn, {width: iconBtn, height: iconBtn}]}
            disabled={!hasPrevious && currentTime <= 3}
            onPress={handlePrevious}>
            <Icon
              name="play-skip-back"
              size={18}
              color={hasPrevious || currentTime > 3 ? COLORS.text : COLORS.textMuted}
            />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.tapArea}
          onPress={() => openPlayerScreen(media, streamUrl)}
          activeOpacity={0.92}>
          {media.thumbnailUrl ? (
            <Image source={{uri: media.thumbnailUrl}} style={[styles.thumb, {width: thumb, height: thumb}]} />
          ) : (
            <LinearGradient colors={[accent, `${accent}88`]} style={[styles.thumb, {width: thumb, height: thumb}]}>
              <Icon name={media.type === 'VIDEO' ? 'videocam' : 'musical-notes'} size={layout.font.sm} color="#111" />
            </LinearGradient>
          )}
          <View style={styles.meta}>
            <Text style={[styles.title, {fontSize: layout.font.sm}]} numberOfLines={1}>{media.title}</Text>
            <View style={styles.progressRow}>
              {queueActive ? (
                <Text style={[styles.queueHint, {color: accent, fontSize: layout.font.xs}]}>{queueIndex + 1}/{queueLength}</Text>
              ) : null}
              <View style={styles.progressFlex}>
                <SeekableProgressBar
                  progress={progress}
                  duration={duration}
                  onSeek={seekTo}
                  accentColor={accent}
                  height={2}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.playBtn, {backgroundColor: ENTERPRISE.brand, width: playBtn, height: playBtn, borderRadius: playBtn / 2}]} onPress={togglePause}>
          {buffering ? (
            <ActivityIndicator size="small" color="#111" />
          ) : (
            <Icon name={paused ? 'play' : 'pause'} size={18} color="#111" />
          )}
        </TouchableOpacity>
        {queueActive ? (
          <TouchableOpacity style={[styles.iconBtn, {width: iconBtn, height: iconBtn}]} disabled={!hasNext} onPress={playNext}>
            <Icon name="play-skip-forward" size={18} color={hasNext ? COLORS.text : COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.iconBtn, {width: iconBtn, height: iconBtn}]} onPress={stop}>
          <Icon name="close" size={17} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 100,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 1,
    borderColor: ENTERPRISE.headerBorder,
    backgroundColor: ENTERPRISE.headerBg,
    paddingRight: 6,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  accentEdge: {
    width: 3,
    alignSelf: 'stretch',
    borderTopLeftRadius: ENTERPRISE.radius.md,
    borderBottomLeftRadius: ENTERPRISE.radius.md,
  },
  tapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingLeft: SPACING.sm,
  },
  thumb: {
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  meta: {flex: 1, gap: 4},
  title: {color: COLORS.text, fontWeight: '700'},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  progressFlex: {flex: 1},
  queueHint: {fontWeight: '800', minWidth: 28},
  playBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
