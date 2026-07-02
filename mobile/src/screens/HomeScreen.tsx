import React, {useCallback, useState} from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BrowseTile} from '../components/BrowseTile';
import {FeatureCard} from '../components/FeatureCard';
import {HomeMediaRow} from '../components/HomeMediaRow';
import {SectionHeader} from '../components/SectionHeader';
import {api, discoverServer, MediaItem} from '../api/client';
import {COLORS, GRADIENTS, RADIUS, SPACING} from '../config';
import {usePlayback} from '../context/PlaybackContext';
import {useTheme} from '../context/ThemeContext';
import {
  goToCameraTab,
  goToFacesTab,
  goToMediaTab,
  openPlayerScreen,
  openSettings,
} from '../navigation/navigationRef';
import {resolveStreamUrl} from '../utils/mediaPlayback';
import {loadRecentMedia, RecentMediaEntry} from '../utils/recentMedia';
import {useLayoutMetrics} from '../utils/layout';

const BROWSE = [
  {title: 'Bollywood', subtitle: 'Top hits', icon: 'sparkles', query: 'Bollywood hits', colors: ['#5B4FCF', '#2A2060'] as [string, string]},
  {title: 'Lo-fi', subtitle: 'Chill beats', icon: 'cafe', query: 'Lo-fi beats', colors: ['#1E6B5C', '#0E2820'] as [string, string]},
  {title: 'Pop', subtitle: 'Fresh tracks', icon: 'radio', query: 'Pop music 2024', colors: ['#C0267A', '#4A1030'] as [string, string]},
  {title: 'Music videos', subtitle: 'HD playback', icon: 'play-circle', query: 'Music video HD', colors: ['#2563EB', '#0F172A'] as [string, string]},
];

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function HomeScreen() {
  const {colors} = useTheme();
  const layout = useLayoutMetrics(true);
  const insets = useSafeAreaInsets();
  const {media, streamUrl, paused, togglePause, play} = usePlayback();
  const [savedItems, setSavedItems] = useState<MediaItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentMediaEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [audio, video, recent] = await Promise.allSettled([
      api.getAudioLibrary(),
      api.getVideoLibrary(),
      loadRecentMedia(),
    ]);

    const audioList = audio.status === 'fulfilled' ? audio.value.data || [] : [];
    const videoList = video.status === 'fulfilled' ? video.value.data || [] : [];
    const merged = [...audioList, ...videoList]
      .sort((a, b) => (b.downloadedAt || '').localeCompare(a.downloadedAt || ''))
      .slice(0, 10);
    setSavedItems(merged);
    setRecentItems(recent.status === 'fulfilled' ? recent.value : []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await discoverServer();
    await load();
    setRefreshing(false);
  };

  const resumePlayback = () => {
    if (media && streamUrl) {
      openPlayerScreen(media, streamUrl);
    }
  };

  const playRecent = (item: RecentMediaEntry) => {
    if (!item.streamUrl) {
      goToMediaTab('SearchTab');
      return;
    }
    const url = resolveStreamUrl(item.streamUrl);
    const playable = {
      title: item.title,
      type: item.type,
      streamUrl: url,
      thumbnailUrl: item.thumbnailUrl,
      videoId: item.videoId,
      sourceUrl: item.sourceUrl,
      libraryId: item.libraryId,
    };
    play(playable, url);
    openPlayerScreen(playable, url);
  };

  const playSaved = (item: MediaItem) => {
    const url = resolveStreamUrl(item.streamUrl);
    const playable = {
      title: item.title,
      type: item.type,
      streamUrl: url,
      thumbnailUrl: item.thumbnailUrl,
      libraryId: item.id,
      sourceUrl: item.sourceUrl,
    };
    play(playable, url);
    openPlayerScreen(playable, url);
  };

  const gridW = layout.halfGridWidth;

  return (
    <LinearGradient colors={GRADIENTS.media} style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + SPACING.sm,
            paddingBottom: layout.contentBottomPad + SPACING.lg,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }>
        {/* Top bar */}
        <View style={[styles.topBar, {paddingHorizontal: layout.hPad}]}>
          <View style={styles.topCopy}>
            <Text style={[styles.greeting, {fontSize: layout.font.sm, color: colors.textMuted}]}>
              {timeGreeting()}
            </Text>
            <Text style={[styles.headline, {fontSize: layout.font.xl, lineHeight: layout.font.lineLg}]}>
              What do you want to play?
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.settingsBtn, {width: layout.headerBtn, height: layout.headerBtn}]}
            onPress={openSettings}
            hitSlop={8}>
            <Icon name="settings-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search entry */}
        <TouchableOpacity
          style={[styles.searchEntry, {marginHorizontal: layout.hPad}]}
          onPress={() => goToMediaTab('SearchTab')}
          activeOpacity={0.9}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <Text style={[styles.searchPlaceholder, {fontSize: layout.font.md}]}>
            Songs, artists, music videos…
          </Text>
        </TouchableOpacity>

        {/* Now playing */}
        {media && streamUrl ? (
          <TouchableOpacity
            style={[styles.nowPlaying, {marginHorizontal: layout.hPad, borderColor: `${colors.primary}44`}]}
            onPress={resumePlayback}
            activeOpacity={0.9}>
            <LinearGradient
              colors={[`${colors.primary}33`, `${colors.accent}12`]}
              style={styles.nowPlayingInner}>
              {media.thumbnailUrl ? (
                <Image source={{uri: media.thumbnailUrl}} style={styles.nowThumb} />
              ) : (
                <View style={[styles.nowThumb, styles.nowThumbFallback, {backgroundColor: `${colors.primary}44`}]}>
                  <Icon
                    name={media.type === 'VIDEO' ? 'videocam' : 'musical-notes'}
                    size={20}
                    color={colors.text}
                  />
                </View>
              )}
              <View style={styles.nowMeta}>
                <Text style={[styles.nowLabel, {color: colors.primary, fontSize: layout.font.xs}]}>
                  {paused ? 'Paused' : 'Now playing'}
                </Text>
                <Text style={[styles.nowTitle, {fontSize: layout.font.md}]} numberOfLines={1}>
                  {media.title}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.nowPlayBtn, {backgroundColor: colors.primary}]}
                onPress={e => {
                  e.stopPropagation?.();
                  togglePause();
                }}>
                <Icon name={paused ? 'play' : 'pause'} size={18} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        <SectionHeader title="Browse" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.hScroll, {paddingHorizontal: layout.hPad}]}>
          {BROWSE.map(item => (
            <BrowseTile
              key={item.title}
              title={item.title}
              subtitle={item.subtitle}
              icon={item.icon}
              colors={item.colors}
              onPress={() => goToMediaTab('SearchTab', item.query)}
            />
          ))}
        </ScrollView>

        {savedItems.length > 0 ? (
          <>
            <SectionHeader
              title="Your saves"
              actionLabel="Library"
              onAction={() => goToMediaTab('AudioTab')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.hScroll, {paddingHorizontal: layout.hPad}]}>
              {savedItems.map(item => (
                <HomeMediaRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.type === 'AUDIO' ? 'Music' : 'Video'}
                  thumbnailUrl={item.thumbnailUrl}
                  type={item.type}
                  onPress={() => playSaved(item)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        {recentItems.length > 0 && !media ? (
          <>
            <SectionHeader title="Listen again" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.hScroll, {paddingHorizontal: layout.hPad}]}>
              {recentItems.slice(0, 8).map(item => (
                <HomeMediaRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.type === 'AUDIO' ? 'Audio' : 'Video'}
                  thumbnailUrl={item.thumbnailUrl}
                  type={item.type}
                  onPress={() => playRecent(item)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        <SectionHeader title="Explore" />
        <View style={[styles.exploreGrid, {paddingHorizontal: layout.hPad, gap: layout.gap}]}>
          <FeatureCard
            icon="search"
            title="Search"
            subtitle="Find anything"
            colors={[`${colors.primary}55`, `${colors.primary}15`]}
            accent={colors.primary}
            layout="grid"
            width={gridW}
            onPress={() => goToMediaTab('SearchTab')}
          />
          <FeatureCard
            icon="library"
            title="Library"
            subtitle="Offline saves"
            colors={[`${colors.audio}50`, `${colors.audio}12`]}
            accent={colors.audio}
            layout="grid"
            width={gridW}
            badge={savedItems.length > 0 ? String(savedItems.length) : undefined}
            onPress={() => goToMediaTab('AudioTab')}
          />
          <FeatureCard
            icon="camera"
            title="Camera"
            subtitle="Geo photos"
            colors={[`${colors.camera}50`, `${colors.camera}12`]}
            accent={colors.camera}
            layout="grid"
            width={gridW}
            onPress={goToCameraTab}
          />
          <FeatureCard
            icon="happy"
            title="Faces"
            subtitle="Who is this?"
            colors={[`${colors.face}45`, `${colors.face}10`]}
            accent={colors.face}
            layout="grid"
            width={gridW}
            onPress={goToFacesTab}
          />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  content: {},
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  topCopy: {flex: 1, minWidth: 0},
  greeting: {
    fontWeight: '600',
    marginBottom: 4,
  },
  headline: {
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  settingsBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  searchPlaceholder: {
    color: COLORS.textMuted,
    fontWeight: '600',
    flex: 1,
  },
  nowPlaying: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  nowPlayingInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  nowThumb: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.sm,
  },
  nowThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowMeta: {flex: 1, minWidth: 0},
  nowLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  nowTitle: {
    color: COLORS.text,
    fontWeight: '700',
  },
  nowPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hScroll: {
    gap: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  exploreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
