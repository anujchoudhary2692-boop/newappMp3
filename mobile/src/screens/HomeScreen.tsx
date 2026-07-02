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
import {useFocusEffect} from '@react-navigation/native';
import {CatalogCard} from '../components/enterprise/CatalogCard';
import {CatalogSection} from '../components/enterprise/CatalogSection';
import {EnterpriseHeader} from '../components/enterprise/EnterpriseHeader';
import {EnterpriseSearchBar} from '../components/enterprise/EnterpriseSearchBar';
import {HeroBanner} from '../components/enterprise/HeroBanner';
import {ServiceGrid, ServiceItem} from '../components/enterprise/ServiceGrid';
import {api, discoverServer, MediaItem} from '../api/client';
import {usePlayback} from '../context/PlaybackContext';
import {useTheme} from '../context/ThemeContext';
import {
  goToCameraTab,
  goToFacesTab,
  goToMediaTab,
  openGuide,
  openPlayerScreen,
  openSettings,
} from '../navigation/navigationRef';
import {ENTERPRISE, enterpriseStyles} from '../theme/enterprise';
import {formatBytes, listLocalMedia, localRecordToMediaItem} from '../utils/localMediaStore';
import {prepareAndStartPlayback} from '../utils/playSearchItem';
import {resolveLibraryStreamUrl} from '../utils/playbackQueue';
import {loadRecentMedia, RecentMediaEntry} from '../utils/recentMedia';
import {useLayoutMetrics} from '../utils/layout';

const TRENDING = [
  {query: 'Bollywood hits', title: 'Bollywood', sub: 'Trending now'},
  {query: 'Lo-fi beats', title: 'Lo-fi', sub: 'Focus & chill'},
  {query: 'Pop music 2024', title: 'Pop', sub: 'Top charts'},
  {query: 'Music video HD', title: 'HD Videos', sub: 'Watch in HD'},
];

export function HomeScreen() {
  const {colors} = useTheme();
  const layout = useLayoutMetrics(true);
  const {media, streamUrl, paused, togglePause, play} = usePlayback();
  const [savedItems, setSavedItems] = useState<MediaItem[]>([]);
  const [recentItems, setRecentItems] = useState<RecentMediaEntry[]>([]);
  const [peopleCount, setPeopleCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [audio, video, recent, people, localAudio, localVideo] = await Promise.allSettled([
      api.getAudioLibrary(),
      api.getVideoLibrary(),
      loadRecentMedia(),
      api.getPersons(),
      listLocalMedia('AUDIO'),
      listLocalMedia('VIDEO'),
    ]);

    const audioList = audio.status === 'fulfilled' ? audio.value.data || [] : [];
    const videoList = video.status === 'fulfilled' ? video.value.data || [] : [];
    const localItems = [
      ...(localAudio.status === 'fulfilled' ? localAudio.value : []),
      ...(localVideo.status === 'fulfilled' ? localVideo.value : []),
    ].map(localRecordToMediaItem);
    const merged = [...audioList, ...videoList, ...localItems]
      .sort((a, b) => (b.downloadedAt || '').localeCompare(a.downloadedAt || ''))
      .slice(0, 12);
    setSavedItems(merged);
    setRecentItems(recent.status === 'fulfilled' ? recent.value : []);
    setPeopleCount(people.status === 'fulfilled' ? people.value.data?.length ?? 0 : 0);
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

  const playItem = async (
    title: string,
    type: 'AUDIO' | 'VIDEO',
    streamPath: string,
    thumbnailUrl?: string,
    libraryId?: string,
    sourceUrl?: string,
    videoId?: string,
  ) => {
    if (videoId && !streamPath.startsWith('file://')) {
      await prepareAndStartPlayback(
        {
          videoId,
          title,
          thumbnailUrl: thumbnailUrl || '',
          channel: '',
          sourceUrl: sourceUrl || `https://www.youtube.com/watch?v=${videoId}`,
        },
        type,
        play,
      );
      return;
    }
    const url = streamPath.startsWith('file://')
      ? streamPath
      : await resolveLibraryStreamUrl({
          id: libraryId || title,
          title,
          type,
          streamUrl: streamPath,
          fileName: '',
          thumbnailUrl: thumbnailUrl || '',
          sourceUrl: sourceUrl || '',
        });
    const playable = {
      title,
      type,
      streamUrl: url,
      thumbnailUrl,
      libraryId,
      sourceUrl,
      videoId,
    };
    play(playable, url);
    openPlayerScreen(playable, url);
  };

  const services: ServiceItem[] = [
    {id: 'search', label: 'Search', icon: 'search', color: colors.primary, onPress: () => goToMediaTab('SearchTab')},
    {id: 'music', label: 'Music', icon: 'musical-notes', color: colors.audio, onPress: () => goToMediaTab('AudioTab')},
    {id: 'video', label: 'Videos', icon: 'videocam', color: colors.video, onPress: () => goToMediaTab('VideoTab')},
    {id: 'camera', label: 'Camera', icon: 'camera', color: colors.camera, onPress: goToCameraTab},
    {id: 'faces', label: 'Face AI', icon: 'scan', color: colors.face, onPress: goToFacesTab},
    {id: 'library', label: 'Downloads', icon: 'download', color: ENTERPRISE.brand, onPress: () => goToMediaTab('AudioTab')},
    {id: 'guide', label: 'Help', icon: 'book', color: colors.accent, onPress: openGuide},
    {id: 'settings', label: 'Account', icon: 'person', color: '#C7CED4', onPress: openSettings},
  ];

  return (
    <View style={enterpriseStyles.page}>
      <EnterpriseHeader
        subtitle="Media · AI · Cloud"
        showGuide
        onGuide={openGuide}
        searchSlot={
          <EnterpriseSearchBar
            editable={false}
            placeholder="Search MediaFace"
            onPress={() => goToMediaTab('SearchTab')}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ENTERPRISE.brand} />
        }
        contentContainerStyle={{paddingBottom: layout.contentBottomPad + 16}}>
        {media && streamUrl ? (
          <TouchableOpacity
            style={styles.nowPlaying}
            onPress={() => openPlayerScreen(media, streamUrl)}
            activeOpacity={0.94}>
            <View style={styles.nowInner}>
              {media.thumbnailUrl ? (
                <Image source={{uri: media.thumbnailUrl}} style={styles.nowThumb} />
              ) : (
                <View style={[styles.nowThumb, styles.nowFallback]}>
                  <Icon name="musical-notes" size={18} color="#fff" />
                </View>
              )}
              <View style={styles.nowMeta}>
                <Text style={styles.nowEyebrow}>{paused ? 'PAUSED' : 'NOW PLAYING'}</Text>
                <Text style={styles.nowTitle} numberOfLines={1}>
                  {media.title}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.nowBtn}
                onPress={e => {
                  e.stopPropagation?.();
                  togglePause();
                }}>
                <Icon name={paused ? 'play' : 'pause'} size={18} color="#111" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ) : null}

        <HeroBanner
          title="Stream unlimited music & HD video"
          subtitle="Search, play offline, and manage your library in one place."
          cta="Start exploring"
          icon="play-circle"
          colors={['#146EB4', '#0B2845']}
          onPress={() => goToMediaTab('SearchTab')}
        />

        <View style={enterpriseStyles.section}>
          <Text style={[styles.sectionLabel, {paddingHorizontal: layout.hPad}]}>Shop by category</Text>
          <ServiceGrid items={services} />
        </View>

        <CatalogSection
          title="Trending searches"
          subtitle="Popular picks this week"
          actionLabel="Search all"
          onAction={() => goToMediaTab('SearchTab')}>
          {TRENDING.map(item => (
            <CatalogCard
              key={item.query}
              title={item.title}
              subtitle={item.sub}
              type={item.query.includes('video') ? 'VIDEO' : 'AUDIO'}
              badge="HOT"
              onPress={() => goToMediaTab('SearchTab', item.query)}
            />
          ))}
        </CatalogSection>

        {savedItems.length > 0 ? (
          <CatalogSection
            title="Your library"
            subtitle={`${savedItems.length} saved items`}
            onAction={() => goToMediaTab('AudioTab')}>
            {savedItems.map(item => (
              <CatalogCard
                key={item.id}
                title={item.title}
                subtitle={item.streamUrl.startsWith('file://') ? 'On device · Offline' : item.type === 'AUDIO' ? 'Music · Cloud' : 'Video · Cloud'}
                thumbnailUrl={item.thumbnailUrl}
                type={item.type}
                badge={item.type === 'AUDIO' ? 'MP3' : 'HD'}
                onPress={() =>
                  playItem(
                    item.title,
                    item.type,
                    item.streamUrl,
                    item.thumbnailUrl,
                    item.id,
                    item.sourceUrl,
                  )
                }
              />
            ))}
          </CatalogSection>
        ) : null}

        {recentItems.length > 0 ? (
          <CatalogSection title="Continue listening" subtitle="Pick up where you left off">
            {recentItems.slice(0, 10).map(item => (
              <CatalogCard
                key={item.id}
                title={item.title}
                subtitle={item.type === 'AUDIO' ? 'Audio' : 'Video'}
                thumbnailUrl={item.thumbnailUrl}
                type={item.type}
                onPress={() => {
                  if (item.videoId) {
                    playItem(
                      item.title,
                      item.type,
                      '',
                      item.thumbnailUrl,
                      item.libraryId,
                      item.sourceUrl,
                      item.videoId,
                    );
                  } else {
                    goToMediaTab('SearchTab');
                  }
                }}
              />
            ))}
          </CatalogSection>
        ) : null}

        <View style={[enterpriseStyles.section, {paddingHorizontal: layout.hPad}]}>
          <Text style={styles.promoTitle}>MediaFace Prime features</Text>
          <View style={styles.promoGrid}>
            <PromoTile icon="cloud-done" label="Cloud sync" detail="Works when Mac is off" />
            <PromoTile icon="scan" label="Face AI" detail={`${peopleCount} people registered`} />
            <PromoTile icon="location" label="Geo camera" detail="GPS tagged captures" />
            <PromoTile icon="download" label="Offline mode" detail="Save MP3 & HD video" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PromoTile({icon, label, detail}: {icon: string; label: string; detail: string}) {
  return (
    <View style={styles.promoTile}>
      <Icon name={icon} size={20} color={ENTERPRISE.brand} />
      <Text style={styles.promoLabel}>{label}</Text>
      <Text style={styles.promoDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nowPlaying: {
    backgroundColor: '#1A222D',
    borderBottomWidth: 1,
    borderBottomColor: ENTERPRISE.divider,
  },
  nowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  nowThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  nowFallback: {
    backgroundColor: '#37475A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowMeta: {flex: 1, minWidth: 0},
  nowEyebrow: {
    color: ENTERPRISE.brand,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  nowTitle: {
    color: '#fff',
    fontWeight: '700',
    marginTop: 2,
    fontSize: 15,
  },
  nowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ENTERPRISE.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  promoTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  promoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  promoTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: ENTERPRISE.pageBg,
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
    padding: 12,
    gap: 4,
  },
  promoLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  promoDetail: {
    color: '#879596',
    fontWeight: '600',
    fontSize: 12,
  },
});
