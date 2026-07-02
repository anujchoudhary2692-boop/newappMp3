import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Video, {OnLoadData, OnProgressData, VideoRef} from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppHeader} from '../../components/AppHeader';
import {SeekableProgressBar} from '../../components/SeekableProgressBar';
import {useAutoHideControls} from '../../hooks/useAutoHideControls';
import {COLORS, GRADIENTS, RADIUS, SHADOW, SPACING} from '../../config';
import {MediaStackParamList} from '../../navigation/types';
import {api, discoverMediaServer, PlayableMedia} from '../../api/client';
import {usePlayback} from '../../context/PlaybackContext';
import {useLayoutMetrics} from '../../utils/layout';
import {buildMediaSource} from '../../utils/mediaPlayback';
import {showDownloadError} from '../../utils/playSearchItem';

type Props = NativeStackScreenProps<MediaStackParamList, 'Player'>;

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatRate(rate: number) {
  return rate === 1 ? '1x' : `${rate}x`;
}

interface FeatureChipProps {
  icon: string;
  label: string;
  active?: boolean;
  accent?: string;
  onPress: () => void;
}

function FeatureChip({icon, label, active, accent = COLORS.primary, onPress}: FeatureChipProps) {
  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <LinearGradient
          colors={[`${accent}44`, `${accent}18`]}
          style={[styles.featureChip, styles.featureChipActive, {borderColor: accent}]}>
          <Icon name={icon} size={15} color={accent} />
          <Text style={[styles.featureChipText, {color: accent}]}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.featureChip} onPress={onPress} activeOpacity={0.85}>
      <Icon name={icon} size={15} color={COLORS.textSecondary} />
      <Text style={styles.featureChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

interface PlayerControlsProps {
  currentTime: number;
  duration: number;
  paused: boolean;
  onSeek: (seconds: number) => void;
  onSeekTo: (seconds: number) => void;
  onTogglePause: () => void;
  compact?: boolean;
  accentColor?: string;
  onInteraction?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  embedded?: boolean;
}

function PlayerControls({
  currentTime,
  duration,
  paused,
  onSeek,
  onSeekTo,
  onTogglePause,
  compact,
  accentColor = COLORS.primary,
  onInteraction,
  hasPrevious,
  hasNext,
  onPreviousTrack,
  onNextTrack,
  embedded,
}: PlayerControlsProps) {
  const progress = duration > 0 ? currentTime / duration : 0;
  const showQueueNav = hasPrevious || hasNext;
  return (
    <View style={[
      styles.controlsSection,
      compact && styles.controlsCompact,
      embedded && styles.controlsEmbedded,
    ]}>
      <View style={styles.progressRow}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <SeekableProgressBar
          progress={progress}
          duration={duration}
          onSeek={seconds => {
            onSeekTo(seconds);
            onInteraction?.();
          }}
          accentColor={accentColor}
          height={compact ? 3 : 4}
        />
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </View>
      <View style={[styles.controlsRow, compact && styles.controlsRowCompact]}>
        {showQueueNav ? (
          <TouchableOpacity
            style={[styles.skipBtn, !hasPrevious && styles.skipBtnDisabled]}
            disabled={!hasPrevious}
            onPress={() => { onPreviousTrack?.(); onInteraction?.(); }}>
            <Icon name="play-skip-back" size={compact ? 20 : 24} color={hasPrevious ? COLORS.text : COLORS.textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.skipBtn} onPress={() => { onSeek(-10); onInteraction?.(); }}>
            <Icon name="play-back" size={compact ? 20 : 24} color={COLORS.text} />
            {!compact ? <Text style={styles.skipLabel}>10s</Text> : null}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.playBtn, compact && styles.playBtnCompact, {backgroundColor: accentColor}]}
          onPress={() => { onTogglePause(); onInteraction?.(); }}>
          <Icon name={paused ? 'play' : 'pause'} size={compact ? 26 : 32} color={COLORS.text} />
        </TouchableOpacity>
        {showQueueNav ? (
          <TouchableOpacity
            style={[styles.skipBtn, !hasNext && styles.skipBtnDisabled]}
            disabled={!hasNext}
            onPress={() => { onNextTrack?.(); onInteraction?.(); }}>
            <Icon name="play-skip-forward" size={compact ? 20 : 24} color={hasNext ? COLORS.text : COLORS.textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.skipBtn} onPress={() => { onSeek(10); onInteraction?.(); }}>
            <Icon name="play-forward" size={compact ? 20 : 24} color={COLORS.text} />
            {!compact ? <Text style={styles.skipLabel}>10s</Text> : null}
          </TouchableOpacity>
        )}
      </View>
      {showQueueNav && !compact ? (
        <View style={styles.fineSeekRow}>
          <TouchableOpacity style={styles.fineSeekBtn} onPress={() => { onSeek(-10); onInteraction?.(); }}>
            <Icon name="play-back" size={16} color={COLORS.textSecondary} />
            <Text style={styles.fineSeekLabel}>-10s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fineSeekBtn} onPress={() => { onSeek(10); onInteraction?.(); }}>
            <Icon name="play-forward" size={16} color={COLORS.textSecondary} />
            <Text style={styles.fineSeekLabel}>+10s</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export function PlayerScreen({route, navigation}: Props) {
  const insets = useSafeAreaInsets();
  const layout = useLayoutMetrics(true);
  const playback = usePlayback();
  const {item, media, streamUrl} = route.params;
  const playable = useMemo(
    () => media ?? (item ? {
      title: item.title,
      type: item.type,
      streamUrl,
      thumbnailUrl: item.thumbnailUrl,
      quality: item.quality,
    } : null),
    [item, media, streamUrl],
  );

  const toPlayableMedia = useCallback((): PlayableMedia => {
    if (media) {
      return media;
    }
    return {
      title: item!.title,
      type: item!.type,
      streamUrl,
      thumbnailUrl: item!.thumbnailUrl,
      quality: item!.quality,
      sourceUrl: item!.sourceUrl,
    };
  }, [item, media, streamUrl]);

  const videoRef = useRef<VideoRef>(null);
  const fullscreenVideoRef = useRef<VideoRef>(null);
  const currentTimeRef = useRef(0);
  const resumeAtRef = useRef(0);
  const streamUrlRef = useRef(streamUrl);
  const mediaRef = useRef(toPlayableMedia());
  const prevStreamUrlRef = useRef<string | null>(null);
  streamUrlRef.current = streamUrl;
  mediaRef.current = toPlayableMedia();

  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState<'AUDIO' | 'VIDEO' | null>(null);
  const [streamKey, setStreamKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showInlineControls, setShowInlineControls] = useState(true);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const playing = !paused;
  const {clearTimer, scheduleHide} = useAutoHideControls(showInlineControls, playing);
  const fullscreenAutoHide = useAutoHideControls(showFullscreenControls, playing);

  const videoProps = {
    ignoreSilentSwitch: 'ignore' as const,
    playInBackground: true,
    playWhenInactive: true,
    bufferConfig: {
      minBufferMs: 1500,
      maxBufferMs: 8000,
      bufferForPlaybackMs: 400,
      bufferForPlaybackAfterRebufferMs: 800,
    },
  };

  useEffect(() => {
    return () => {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, []);

  const clearSleepTimer = useCallback(() => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    sleepTimeoutRef.current = null;
    sleepIntervalRef.current = null;
    setSleepRemainingSec(null);
  }, []);

  const startSleepTimer = useCallback((minutes: number) => {
    clearSleepTimer();
    const totalSec = minutes * 60;
    setSleepRemainingSec(totalSec);
    setShowSleepModal(false);
    sleepTimeoutRef.current = setTimeout(() => {
      clearSleepTimer();
      playback.stop();
      navigation.goBack();
    }, totalSec * 1000);
    sleepIntervalRef.current = setInterval(() => {
      setSleepRemainingSec(prev => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
  }, [clearSleepTimer, navigation, playback]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({message: `🎵 ${playable?.title ?? 'MediaFace track'}`});
    } catch {
      // user cancelled
    }
  }, [playable?.title]);

  useFocusEffect(
    useCallback(() => {
      if (!playable) {
        return undefined;
      }
      const nextMedia = mediaRef.current;
      playback.syncFromRoute(nextMedia, streamUrlRef.current);
      const handoffTime =
        playback.streamUrl === streamUrlRef.current && playback.engineActive
          ? playback.currentTime
          : 0;
      resumeAtRef.current = handoffTime;
      playback.deactivateEngine();
      setPaused(false);
      setBuffering(true);
      setStreamKey(key => key + 1);
      return () => {
        playback.syncFromRoute(mediaRef.current, streamUrlRef.current);
        playback.activateEngine(currentTimeRef.current);
      };
    }, [playable, playback]),
  );

  useEffect(() => {
    if (!playable) {
      return;
    }
    const isTrackChange =
      prevStreamUrlRef.current !== null && prevStreamUrlRef.current !== streamUrl;
    prevStreamUrlRef.current = streamUrl;

    if (isTrackChange) {
      resumeAtRef.current = 0;
      setCurrentTime(0);
      setDuration(0);
      currentTimeRef.current = 0;
      setError(false);
    }

    setPaused(false);
    setBuffering(true);
    setStreamKey(key => key + 1);
    playback.syncFromRoute(toPlayableMedia(), streamUrl);
  }, [streamUrl, playable, playback, toPlayableMedia]);

  useEffect(() => {
    const isVideoTrack = playable?.type === 'VIDEO';
    if (!playing || isVideoTrack) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {toValue: 1.06, duration: 1200, useNativeDriver: true}),
        Animated.timing(pulseAnim, {toValue: 1, duration: 1200, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [playing, playable?.type, pulseAnim]);

  useEffect(() => {
    if (!isFullscreen && playing) {
      scheduleHide(setShowInlineControls);
    }
    return clearTimer;
  }, [showInlineControls, playing, isFullscreen, scheduleHide, clearTimer]);

  useEffect(() => {
    if (isFullscreen && playing) {
      fullscreenAutoHide.scheduleHide(setShowFullscreenControls);
    }
    return fullscreenAutoHide.clearTimer;
  }, [showFullscreenControls, playing, isFullscreen, fullscreenAutoHide]);

  const onLoad = (data: OnLoadData) => {
    setDuration(data.duration);
    setBuffering(false);
    setError(false);
    if (resumeAtRef.current > 0) {
      const target = resumeAtRef.current;
      resumeAtRef.current = 0;
      videoRef.current?.seek(target);
      fullscreenVideoRef.current?.seek(target);
      setCurrentTime(target);
      currentTimeRef.current = target;
    }
  };

  const onProgress = (data: OnProgressData) => {
    setCurrentTime(data.currentTime);
    currentTimeRef.current = data.currentTime;
  };

  const seekBy = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(duration || 0, currentTime + seconds));
    videoRef.current?.seek(next);
    fullscreenVideoRef.current?.seek(next);
    setCurrentTime(next);
  }, [currentTime, duration]);

  const seekTo = useCallback((seconds: number) => {
    const next = Math.max(0, Math.min(duration || 0, seconds));
    videoRef.current?.seek(next);
    fullscreenVideoRef.current?.seek(next);
    setCurrentTime(next);
  }, [duration]);

  const handlePreviousTrack = useCallback(() => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    playback.playPrevious();
  }, [currentTime, playback, seekTo]);

  const handleNextTrack = useCallback(() => {
    playback.playNext();
  }, [playback]);

  const handleTrackEnd = useCallback(() => {
    const atEnd = playback.queueLength > 0 && playback.queueIndex >= playback.queueLength - 1;
    const willRepeat = playback.repeatQueue && playback.queueLength > 0;
    playback.onTrackEnd();
    if (atEnd && !willRepeat) {
      setPaused(true);
    }
  }, [playback]);

  const toggleInlineControls = () => {
    setShowInlineControls(v => {
      const next = !v;
      if (next && playing) {
        scheduleHide(setShowInlineControls);
      }
      return next;
    });
  };

  const toggleFullscreenControls = () => {
    setShowFullscreenControls(v => {
      const next = !v;
      if (next && playing) {
        fullscreenAutoHide.scheduleHide(setShowFullscreenControls);
      }
      return next;
    });
  };

  const bumpInlineControls = () => {
    setShowInlineControls(true);
    if (playing) {
      scheduleHide(setShowInlineControls);
    }
  };

  const bumpFullscreenControls = () => {
    setShowFullscreenControls(true);
    if (playing) {
      fullscreenAutoHide.scheduleHide(setShowFullscreenControls);
    }
  };

  const enterFullscreen = () => {
    setIsFullscreen(true);
    setShowFullscreenControls(true);
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
    fullscreenVideoRef.current?.seek(currentTime);
    setShowInlineControls(true);
  };

  if (!playable) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Nothing to play</Text>
      </View>
    );
  }

  const isVideo = playable.type === 'VIDEO';
  const isSearch = !!media;
  const isLandscape = layout.isLandscape;
  const accent = isVideo ? COLORS.video : COLORS.audio;
  const queueActive = playback.queueLength > 1;
  const queueLabel =
    queueActive
      ? `${playback.queueIndex + 1} of ${playback.queueLength}${playback.repeatQueue ? ' · Repeat' : ''}`
      : isVideo
        ? 'Video'
        : 'Audio';

  const videoSource = buildMediaSource(streamUrl, isVideo ? 'VIDEO' : 'AUDIO');

  const videoWidth = layout.contentW;
  const videoHeight = layout.videoStageHeight;
  const artwork = layout.artworkSize;
  const artworkGlow = layout.artworkGlow;
  const playBtnSize = layout.playBtnSize;
  const sleepLabel = sleepRemainingSec !== null
    ? `${Math.floor(sleepRemainingSec / 60)}:${(sleepRemainingSec % 60).toString().padStart(2, '0')}`
    : 'Sleep';

  const featureBar = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featureRow}>
      <FeatureChip
        icon="speedometer-outline"
        label={formatRate(playback.playbackRate)}
        accent={accent}
        onPress={playback.cyclePlaybackRate}
      />
      {queueActive ? (
        <FeatureChip
          icon="repeat"
          label="Repeat"
          active={playback.repeatQueue}
          accent={accent}
          onPress={playback.toggleRepeatQueue}
        />
      ) : null}
      <FeatureChip icon="refresh" label="Restart" accent={accent} onPress={() => seekTo(0)} />
      {queueActive ? (
        <FeatureChip
          icon="list"
          label={`Queue (${playback.queueLength})`}
          accent={accent}
          onPress={() => setShowQueueModal(true)}
        />
      ) : null}
      <FeatureChip
        icon="moon-outline"
        label={sleepRemainingSec !== null ? sleepLabel : 'Sleep'}
        active={sleepRemainingSec !== null}
        accent={accent}
        onPress={() => setShowSleepModal(true)}
      />
      <FeatureChip icon="share-outline" label="Share" accent={accent} onPress={handleShare} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isVideo ? GRADIENTS.playerVideo : GRADIENTS.playerAudio}
        style={StyleSheet.absoluteFill}
      />
      <AppHeader
        title={playable.title}
        subtitle={queueLabel}
        showBack
        accentColor={accent}
      />

      <View style={[styles.body, {paddingHorizontal: layout.hPad, paddingBottom: layout.contentBottomPadWithPlayer}]}>
        {isVideo ? (
          <>
            <Pressable
              style={[styles.videoStage, {width: videoWidth, height: videoHeight}]}
              onPress={toggleInlineControls}>
              <Video
                ref={videoRef}
                key={streamKey}
                source={videoSource}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                paused={paused || isFullscreen}
                rate={playback.playbackRate}
                controls={false}
                {...videoProps}
                onLoad={onLoad}
                onProgress={onProgress}
                onBuffer={({isBuffering}) => setBuffering(isBuffering)}
                onError={e => {
                  setError(true);
                  setBuffering(false);
                  console.warn('Player stream error', e);
                }}
                onEnd={handleTrackEnd}
              />
              {buffering && (
                <View style={styles.videoLoader}>
                  <ActivityIndicator size="small" color={COLORS.video} />
                </View>
              )}
              {!showInlineControls && !buffering && (
                <View style={styles.tapHint}>
                  <Text style={styles.tapHintText}>Tap for controls</Text>
                </View>
              )}
              {showInlineControls && (
                <View style={styles.videoOverlay} pointerEvents="box-none">
                  <LinearGradient
                    colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.7)']}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View style={styles.videoTopRow} pointerEvents="box-none">
                    <TouchableOpacity style={styles.videoIconBtn} onPress={enterFullscreen}>
                      <Icon name="expand" size={18} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.videoBottomControls} pointerEvents="auto">
                    <View style={styles.inlineProgressRow}>
                      <Text style={styles.inlineTime}>{formatTime(currentTime)}</Text>
                      <SeekableProgressBar
                        progress={duration > 0 ? currentTime / duration : 0}
                        duration={duration}
                        onSeek={seekTo}
                        accentColor={COLORS.video}
                        height={3}
                      />
                      <Text style={styles.inlineTime}>{formatTime(duration)}</Text>
                    </View>
                    <View style={styles.inlineControlsRow}>
                      <TouchableOpacity onPress={() => { seekBy(-10); bumpInlineControls(); }}>
                        <Icon name="play-back" size={22} color={COLORS.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.inlinePlayBtn}
                        onPress={() => { setPaused(p => !p); bumpInlineControls(); }}>
                        <Icon name={paused ? 'play' : 'pause'} size={26} color={COLORS.text} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { seekBy(10); bumpInlineControls(); }}>
                        <Icon name="play-forward" size={22} color={COLORS.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </Pressable>
            <Text style={[styles.videoTitle, {fontSize: layout.font.md}]} numberOfLines={2}>{playable.title}</Text>
            {featureBar}
            <PlayerControls
              currentTime={currentTime}
              duration={duration}
              paused={paused}
              onSeek={seekBy}
              onSeekTo={seekTo}
              onTogglePause={() => setPaused(p => !p)}
              compact
              accentColor={COLORS.video}
              hasPrevious={queueActive ? playback.hasPrevious || currentTime > 3 : false}
              hasNext={queueActive ? playback.hasNext : false}
              onPreviousTrack={handlePreviousTrack}
              onNextTrack={handleNextTrack}
            />
          </>
        ) : (
          <View style={styles.audioStage}>
            <View style={styles.artworkGlowWrap}>
              <View style={[styles.artworkGlow, {backgroundColor: `${accent}33`, width: artworkGlow, height: artworkGlow, borderRadius: artworkGlow / 2}]} />
              <Animated.View style={[styles.artworkRing, {borderColor: accent, width: artwork, height: artwork, borderRadius: artwork / 2, transform: [{scale: pulseAnim}]}]}>
                {playable.thumbnailUrl ? (
                  <Image source={{uri: playable.thumbnailUrl}} style={styles.artworkHero} />
                ) : (
                  <LinearGradient colors={[COLORS.audio, COLORS.primaryDark]} style={styles.artworkHero}>
                    <Icon name="musical-notes" size={artwork * 0.35} color={COLORS.text} />
                  </LinearGradient>
                )}
              </Animated.View>
            </View>
            <Text style={[styles.heroTrackTitle, {fontSize: layout.font.lg, lineHeight: layout.font.lineLg, paddingHorizontal: layout.hPad}]} numberOfLines={2}>{playable.title}</Text>
            <View style={styles.chipRowCenter}>
              {playable.quality ? (
                <View style={styles.chipOutline}>
                  <Text style={styles.chipOutlineText}>{playable.quality}</Text>
                </View>
              ) : null}
              {buffering ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <Text style={styles.playingHint}>{paused ? 'Paused' : 'Playing'}</Text>
              )}
            </View>
            <View style={styles.glassCard}>
              <Video
                ref={videoRef}
                key={streamKey}
                source={videoSource}
                style={styles.hiddenVideo}
                paused={paused}
                rate={playback.playbackRate}
                controls={false}
                {...videoProps}
                onLoad={onLoad}
                onProgress={onProgress}
                onBuffer={({isBuffering}) => setBuffering(isBuffering)}
                onError={e => {
                  setError(true);
                  setBuffering(false);
                  console.warn('Player stream error', e);
                }}
                onEnd={handleTrackEnd}
              />
              <PlayerControls
                currentTime={currentTime}
                duration={duration}
                paused={paused}
                onSeek={seekBy}
                onSeekTo={seekTo}
                onTogglePause={() => setPaused(p => !p)}
                compact
                embedded
                accentColor={accent}
                hasPrevious={queueActive ? playback.hasPrevious || currentTime > 3 : false}
                hasNext={queueActive ? playback.hasNext : false}
                onPreviousTrack={handlePreviousTrack}
                onNextTrack={handleNextTrack}
              />
              {featureBar}
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Icon name="alert-circle" size={18} color={COLORS.danger} />
            <Text style={styles.errorText}>
              Playback failed. Wait for Online in Home, then try again or use Download.
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => {
              setError(false); setBuffering(true); setStreamKey(k => k + 1);
            }}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSearch && media?.videoId && (
          <View style={styles.downloadRow}>
            <TouchableOpacity
              style={[styles.downloadBtn, styles.audioDownload]}
              disabled={!!downloading}
              onPress={async () => {
                if (!media.sourceUrl) return;
                setDownloading('AUDIO');
                try {
                  await discoverMediaServer();
                  const response = await api.downloadMedia({
                    videoId: media.videoId!, title: media.title,
                    sourceUrl: media.sourceUrl, type: 'AUDIO',
                  });
                  Alert.alert(response.success ? 'Saved' : 'Failed',
                    response.success ? 'Audio added to library' : response.message || 'Download failed');
                } catch (e) {
                  showDownloadError(e);
                } finally { setDownloading(null); }
              }}>
              {downloading === 'AUDIO' ? <ActivityIndicator color={COLORS.audio} /> : (
                <>
                  <Icon name="download-outline" size={18} color={COLORS.audio} />
                  <Text style={[styles.downloadText, {color: COLORS.audio}]}>Save MP3</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.downloadBtn, styles.videoDownload]}
              disabled={!!downloading}
              onPress={async () => {
                if (!media.sourceUrl) return;
                setDownloading('VIDEO');
                try {
                  await discoverMediaServer();
                  const response = await api.downloadMedia({
                    videoId: media.videoId!, title: media.title,
                    sourceUrl: media.sourceUrl, type: 'VIDEO',
                  });
                  Alert.alert(response.success ? 'Saved' : 'Failed',
                    response.success ? 'Video added to library' : response.message || 'Download failed');
                } catch (e) {
                  showDownloadError(e);
                } finally { setDownloading(null); }
              }}>
              {downloading === 'VIDEO' ? <ActivityIndicator color={COLORS.video} /> : (
                <>
                  <Icon name="download-outline" size={18} color={COLORS.video} />
                  <Text style={[styles.downloadText, {color: COLORS.video}]}>Save HD</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isVideo && (
        <Modal
          visible={isFullscreen}
          animationType="fade"
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          onRequestClose={exitFullscreen}>
          <StatusBar hidden />
          <View style={styles.fullscreenRoot}>
            <Pressable style={styles.fullscreenTapArea} onPress={toggleFullscreenControls}>
              <Video
                ref={fullscreenVideoRef}
                source={videoSource}
                style={styles.fullscreenVideo}
                resizeMode="contain"
                paused={paused}
                rate={playback.playbackRate}
                controls={false}
                {...videoProps}
                onLoad={(data) => {
                  onLoad(data);
                  fullscreenVideoRef.current?.seek(currentTime);
                }}
                onProgress={onProgress}
                onBuffer={({isBuffering}) => setBuffering(isBuffering)}
                onError={e => {
                  setError(true);
                  setBuffering(false);
                  console.warn('Player stream error', e);
                }}
                onEnd={handleTrackEnd}
              />
              {buffering && (
                <View style={styles.fullscreenLoader}>
                  <ActivityIndicator size="large" color={COLORS.video} />
                </View>
              )}
            </Pressable>

            {showFullscreenControls && (
              <Pressable
                style={[styles.fullscreenOverlay, {paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8}]}
                onPress={toggleFullscreenControls}>
                <LinearGradient
                  colors={['rgba(0,0,0,0.7)', 'transparent', 'rgba(0,0,0,0.85)']}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.fullscreenTopBar} pointerEvents="box-none">
                  <TouchableOpacity style={styles.fullscreenClose} onPress={exitFullscreen}>
                    <Icon name="contract" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.fullscreenTitle} numberOfLines={1}>{playable.title}</Text>
                  {!isLandscape ? (
                    <Text style={styles.rotateHint}>Rotate for landscape</Text>
                  ) : null}
                </View>
                <View style={styles.fullscreenControlsWrap} pointerEvents="box-none">
                  <View pointerEvents="auto">
                    <PlayerControls
                      currentTime={currentTime}
                      duration={duration}
                      paused={paused}
                      onSeek={seekBy}
                      onSeekTo={seekTo}
                      onTogglePause={() => setPaused(p => !p)}
                      onInteraction={bumpFullscreenControls}
                      compact
                      accentColor={COLORS.video}
                      hasPrevious={queueActive ? playback.hasPrevious || currentTime > 3 : false}
                      hasNext={queueActive ? playback.hasNext : false}
                      onPreviousTrack={handlePreviousTrack}
                      onNextTrack={handleNextTrack}
                    />
                  </View>
                </View>
              </Pressable>
            )}

            {!showFullscreenControls && !buffering && (
              <View style={styles.fullscreenTapHint} pointerEvents="none">
                <Text style={styles.tapHintText}>Tap to show controls</Text>
              </View>
            )}
          </View>
        </Modal>
      )}

      <Modal visible={showQueueModal} animationType="slide" transparent onRequestClose={() => setShowQueueModal(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowQueueModal(false)}>
          <Pressable style={styles.sheetPanel} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Up Next</Text>
              <TouchableOpacity onPress={() => setShowQueueModal(false)}>
                <Icon name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={playback.queueTracks}
              keyExtractor={track => track.id}
              style={styles.queueList}
              renderItem={({item: track, index}) => {
                const active = index === playback.queueIndex;
                return (
                  <TouchableOpacity
                    style={[styles.queueItem, active && styles.queueItemActive]}
                    onPress={() => {
                      playback.playQueueIndex(index);
                      setShowQueueModal(false);
                    }}>
                    <Text style={[styles.queueIndex, active && {color: accent}]}>{index + 1}</Text>
                    <Text style={[styles.queueTitle, active && styles.queueTitleActive]} numberOfLines={2}>
                      {track.media.title}
                    </Text>
                    {active ? <Icon name="volume-medium" size={16} color={accent} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSleepModal} animationType="fade" transparent onRequestClose={() => setShowSleepModal(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowSleepModal(false)}>
          <Pressable style={styles.sheetPanel} onPress={e => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Sleep Timer</Text>
              <TouchableOpacity onPress={() => setShowSleepModal(false)}>
                <Icon name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            {[15, 30, 45, 60].map(min => (
              <TouchableOpacity key={min} style={styles.sleepOption} onPress={() => startSleepTimer(min)}>
                <Icon name="moon-outline" size={18} color={accent} />
                <Text style={styles.sleepOptionText}>{min} minutes</Text>
              </TouchableOpacity>
            ))}
            {sleepRemainingSec !== null ? (
              <TouchableOpacity style={[styles.sleepOption, styles.sleepCancel]} onPress={clearSleepTimer}>
                <Icon name="close-circle-outline" size={18} color={COLORS.danger} />
                <Text style={[styles.sleepOptionText, {color: COLORS.danger}]}>Cancel timer</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background},
  body: {flex: 1, padding: SPACING.md, gap: SPACING.sm},
  audioStage: {flex: 1, alignItems: 'center', gap: SPACING.sm},
  artworkGlowWrap: {alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm},
  artworkGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.6,
  },
  artworkRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    padding: 3,
    overflow: 'hidden',
  },
  artworkHero: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight,
  },
  heroTrackTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    lineHeight: 24,
  },
  chipRowCenter: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  playingHint: {color: COLORS.textMuted, fontSize: 12, fontWeight: '700'},
  glassCard: {
    width: '100%',
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(22, 22, 30, 0.78)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.md,
  },
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6},
  videoStage: {
    alignSelf: 'center',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  videoTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  videoLoader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  videoOverlay: {...StyleSheet.absoluteFill, justifyContent: 'space-between'},
  videoTopRow: {flexDirection: 'row', justifyContent: 'flex-end', padding: SPACING.xs},
  videoIconBtn: {backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.sm, padding: 8},
  videoBottomControls: {padding: SPACING.sm, gap: SPACING.sm},
  inlineProgressRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.xs},
  inlineTime: {color: COLORS.text, fontSize: 10, width: 34, textAlign: 'center', fontVariant: ['tabular-nums']},
  inlineControlsRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.lg},
  inlinePlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.video,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapHint: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tapHintText: {color: COLORS.textSecondary, fontSize: 11, fontWeight: '600'},
  hiddenVideo: {width: 1, height: 1, opacity: 0, position: 'absolute'},
  controlsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    paddingTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  controlsCompact: {
    marginTop: 0,
    backgroundColor: 'rgba(26,26,36,0.92)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  controlsEmbedded: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingTop: SPACING.xs,
  },
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm},
  timeText: {color: COLORS.textSecondary, fontSize: 11, width: 38, textAlign: 'center', fontVariant: ['tabular-nums']},
  controlsRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.lg},
  controlsRowCompact: {gap: SPACING.md},
  skipBtn: {alignItems: 'center', justifyContent: 'center', minWidth: 40, width: 40, height: 40},
  skipBtnDisabled: {opacity: 0.45},
  skipLabel: {color: COLORS.textMuted, fontSize: 10, marginTop: 2, fontWeight: '600'},
  fineSeekRow: {flexDirection: 'row', justifyContent: 'center', gap: SPACING.lg, marginTop: SPACING.sm},
  fineSeekBtn: {flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 4},
  fineSeekLabel: {color: COLORS.textSecondary, fontSize: 10, fontWeight: '600'},
  playBtn: {width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', ...SHADOW.sm},
  playBtnCompact: {width: 48, height: 48, borderRadius: 24},
  featureRow: {gap: SPACING.xs, paddingVertical: SPACING.xs},
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginRight: SPACING.xs,
  },
  featureChipActive: {},
  featureChipText: {color: COLORS.textSecondary, fontSize: 12, fontWeight: '700'},
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255, 92, 122, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  errorText: {color: COLORS.danger, flex: 1, fontSize: 13},
  retryBtn: {paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.surfaceLight},
  retryText: {color: COLORS.text, fontWeight: '700', fontSize: 12},
  chip: {paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm},
  audioChip: {backgroundColor: 'rgba(124, 92, 255, 0.35)'},
  chipText: {color: COLORS.text, fontWeight: '700', fontSize: 11},
  chipOutline: {borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm},
  chipOutlineText: {color: COLORS.textSecondary, fontSize: 11},
  downloadRow: {flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm},
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    minHeight: 44,
  },
  audioDownload: {borderColor: COLORS.audio, backgroundColor: 'rgba(124, 92, 255, 0.12)'},
  videoDownload: {borderColor: COLORS.video, backgroundColor: 'rgba(255, 107, 157, 0.12)'},
  downloadText: {fontWeight: '800', fontSize: 13},
  sheetBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end'},
  sheetPanel: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.md,
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md},
  sheetTitle: {color: COLORS.text, fontSize: 17, fontWeight: '800'},
  queueList: {maxHeight: 320},
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  queueItemActive: {backgroundColor: 'rgba(124, 92, 255, 0.08)'},
  queueIndex: {color: COLORS.textMuted, fontSize: 12, fontWeight: '700', width: 24},
  queueTitle: {flex: 1, color: COLORS.textSecondary, fontSize: 14},
  queueTitleActive: {color: COLORS.text, fontWeight: '700'},
  sleepOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sleepOptionText: {color: COLORS.text, fontSize: 15, fontWeight: '600'},
  sleepCancel: {borderBottomWidth: 0, marginTop: SPACING.sm},
  fullscreenRoot: {flex: 1, backgroundColor: '#000'},
  fullscreenTapArea: {flex: 1},
  fullscreenVideo: {...StyleSheet.absoluteFill, backgroundColor: '#000'},
  fullscreenLoader: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  fullscreenOverlay: {...StyleSheet.absoluteFill, justifyContent: 'space-between'},
  fullscreenTopBar: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md},
  fullscreenClose: {backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.sm, padding: 10},
  fullscreenTitle: {flex: 1, color: COLORS.text, fontWeight: '700', fontSize: 15},
  rotateHint: {color: COLORS.textSecondary, fontSize: 11, fontWeight: '600'},
  fullscreenControlsWrap: {paddingHorizontal: SPACING.md},
  fullscreenTapHint: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
});
