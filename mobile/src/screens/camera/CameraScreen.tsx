import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
} from 'react-native-vision-camera';
import type {Recorder} from 'react-native-vision-camera';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {GlassSurface} from '../../components/GlassSurface';
import {IconTool, SegmentedControl} from '../../components/SegmentedControl';
import {ToastBanner} from '../../components/ToastBanner';
import {api} from '../../api/client';
import {COLORS, RADIUS, SPACING} from '../../config';
import {CameraStackParamList} from '../../navigation/types';
import {goToMediaTab, openSettings} from '../../navigation/navigationRef';
import {usePlayback} from '../../context/PlaybackContext';
import {formatDurationMs, savePhotoToGallery, saveVideoToGallery} from '../../utils/captureSave';
import {useLayoutMetrics} from '../../utils/layout';
import {
  ensureLocationPermission,
  GeoAddress,
  GeoLocation,
  getCurrentLocation,
  reverseGeocode,
  watchLocation,
  clearLocationWatch,
  resolveCaptureLocation,
} from '../../utils/location';
import {notifyPersonSighted} from '../../utils/faceAlerts';
import {useFeatureFlag} from '../../core/features/FeatureFlagsProvider';

type Nav = NativeStackNavigationProp<CameraStackParamList>;
type CaptureMode = 'photo' | 'video';

const MAX_VIDEO_SECONDS = 60;

function videoMimeType(filePath: string): string {
  return filePath.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
}

function videoFileName(filePath: string): string {
  const ext = filePath.toLowerCase().endsWith('.mov') ? '.mov' : '.mp4';
  return `video_${Date.now()}${ext}`;
}

export function CameraScreen() {
  const navigation = useNavigation<Nav>();
  const layout = useLayoutMetrics(false);
  const recordPulse = useRef(new Animated.Value(1)).current;
  const flashOverlay = useRef(new Animated.Value(0)).current;
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const recordMsRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {deactivateEngine} = usePlayback();
  const geotagFeatureEnabled = useFeatureFlag('cameraGeotag');

  const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
  const [mode, setMode] = useState<CaptureMode>('photo');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [location, setLocation] = useState<GeoLocation | undefined>();
  const [address, setAddress] = useState<GeoAddress | undefined>();
  const [locating, setLocating] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const trackPointsRef = useRef<Array<{lat: number; lng: number; t: number; accuracy?: number}>>([]);
  const locationWatchRef = useRef<number | null>(null);
  const [liveIdentify, setLiveIdentify] = useState(false);
  const [liveMatch, setLiveMatch] = useState<{name: string; confidence: number} | null>(null);
  const liveScanRef = useRef(false);
  const [lastThumb, setLastThumb] = useState<string | undefined>();
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [timerSec, setTimerSec] = useState<0 | 3>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [toast, setToast] = useState<{message: string; icon?: string} | null>(null);

  const {hasPermission: hasCamera, requestPermission: requestCamera} = useCameraPermission();
  const {hasPermission: hasMic, requestPermission: requestMic} = useMicrophonePermission();

  const device = useCameraDevice(cameraPosition);
  const photoOutput = usePhotoOutput({qualityPrioritization: 'balanced'});
  const videoOutput = useVideoOutput({
    targetResolution: CommonResolutions.FHD_16_9,
    enableAudio: true,
    fileType: 'mp4',
  });

  /** Video output must stay attached — toggling outputs breaks recording */
  const outputs = useMemo(
    () => [photoOutput, videoOutput],
    [photoOutput, videoOutput],
  );

  const [sessionReady, setSessionReady] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const showToast = useCallback((message: string, icon = 'checkmark-circle') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({message, icon});
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshLocation = useCallback(async () => {
    setLocating(true);
    try {
      const allowed = await ensureLocationPermission();
      if (!allowed) {
        setLocationEnabled(false);
        setLocation(undefined);
        setAddress(undefined);
        return;
      }
      setLocationEnabled(true);
      const resolved = await resolveCaptureLocation();
      setLocation(resolved.location);
      setAddress(resolved.address);
    } catch {
      setLocation(undefined);
      setAddress(undefined);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (!liveIdentify || !sessionReady || recording || busy) {
      return;
    }
    const timer = setInterval(() => {
      void (async () => {
        if (liveScanRef.current || busy || recording) {
          return;
        }
        liveScanRef.current = true;
        try {
          const photo = await photoOutput.capturePhoto({flashMode: 'off', enableShutterSound: false}, {});
          const path = await photo.saveToTemporaryFileAsync();
          photo.dispose();
          const uri = path.startsWith('file://') ? path : `file://${path}`;
          const res = await api.identifyFace(uri);
          if (res.success && res.data.matched && res.data.personName) {
            setLiveMatch({name: res.data.personName, confidence: res.data.confidence});
            void notifyPersonSighted(res.data.personName, res.data.confidence, address?.shortLabel);
          }
        } catch {
          // ignore background scan errors
        } finally {
          liveScanRef.current = false;
        }
      })();
    }, 3500);
    return () => clearInterval(timer);
  }, [liveIdentify, sessionReady, recording, busy, photoOutput]);

  const bootstrap = useCallback(async () => {
    const camOk = hasCamera || (await requestCamera());
    if (!camOk) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings.', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Settings', onPress: () => Linking.openSettings()},
      ]);
      return;
    }
    // Only grab the mic for video — holding mic in photo mode steals AVAudioSession from playback.
    if (mode === 'video') {
      await requestMic();
    }
    deactivateEngine();
    setReady(true);
    refreshLocation();
  }, [deactivateEngine, hasCamera, mode, refreshLocation, requestCamera, requestMic]);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      setSessionReady(false);
      bootstrap();
      api.getCaptures().then(res => {
        if (res.success && res.data?.[0]?.thumbnailUrl) {
          setLastThumb(api.getImageUrl(res.data[0].thumbnailUrl));
        }
      }).catch(() => {});
      return () => {
        // Critical: stop camera/mic so media playback can own AVAudioSession again.
        setIsFocused(false);
        setSessionReady(false);
        setLiveIdentify(false);
        setLiveMatch(null);
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        if (recorderRef.current?.isRecording) {
          recorderRef.current.stopRecording().catch(() => {});
        }
        if (locationWatchRef.current != null) {
          clearLocationWatch(locationWatchRef.current);
          locationWatchRef.current = null;
        }
      };
    }, [bootstrap]),
  );

  useEffect(() => {
    if (mode === 'video' && ready && !hasMic) {
      requestMic();
    }
  }, [mode, ready, hasMic, requestMic]);

  useEffect(() => {
    if (!recording) {
      recordPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(recordPulse, {toValue: 1.12, duration: 650, useNativeDriver: true}),
        Animated.timing(recordPulse, {toValue: 1, duration: 650, useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, recordPulse]);

  useEffect(() => {
    if (!recording) {
      setRecordMs(0);
      recordMsRef.current = 0;
      return;
    }
    const started = Date.now();
    recordTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - started;
      recordMsRef.current = elapsed;
      setRecordMs(elapsed);
    }, 200);
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, [recording]);

  const pulseFlash = () => {
    flashOverlay.setValue(0.9);
    Animated.timing(flashOverlay, {toValue: 0, duration: 160, useNativeDriver: true}).start();
  };

  const uploadCapture = async (
    filePath: string,
    type: 'PHOTO' | 'VIDEO',
    mimeType: string,
    fileName: string,
    durationMs?: number,
  ) => {
    const geoEnabled = geotagFeatureEnabled && locationEnabled;
    const geo = geoEnabled ? await resolveCaptureLocation() : {};
    const loc = geo.location ?? location;
    const addr = geo.address ?? address;
    await api.uploadCapture({
      fileUri: filePath,
      fileName,
      mimeType,
      type,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
      altitude: loc?.altitude,
      gpsAccuracy: loc?.accuracy,
      heading: loc?.heading,
      address: addr?.displayName,
      city: addr?.city,
      country: addr?.country,
      durationMs,
      clientCapturedAt: new Date().toISOString(),
      trackPointsJson:
        type === 'VIDEO' && trackPointsRef.current.length >= 2
          ? JSON.stringify(trackPointsRef.current)
          : undefined,
    });
  };

  const capturePhotoNow = async () => {
    setBusy(true);
    try {
      const photo = await photoOutput.capturePhoto({flashMode: flash, enableShutterSound: true}, {});
      const path = await photo.saveToTemporaryFileAsync();
      photo.dispose();
      pulseFlash();
      const geoEnabled = geotagFeatureEnabled && locationEnabled;
      const geo = geoEnabled ? await resolveCaptureLocation() : {};
      await savePhotoToGallery(path, geo.location ?? location);
      await uploadCapture(path, 'PHOTO', 'image/jpeg', `photo_${Date.now()}.jpg`);
      try {
        const res = await api.identifyFace(`file://${path}`);
        if (res.success && res.data.matched && res.data.personName) {
          void notifyPersonSighted(res.data.personName, res.data.confidence, address?.shortLabel);
        }
      } catch {
        // face scan optional
      }
      setLastThumb(`file://${path}`);
      showToast(geo.address?.shortLabel ? `Saved · ${geo.address.shortLabel}` : 'Photo saved');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Capture failed', 'alert-circle');
    } finally {
      setBusy(false);
    }
  };

  const handlePhoto = async () => {
    if (busy || countdown != null) {
      return;
    }
    if (timerSec === 0) {
      await capturePhotoNow();
      return;
    }
    let remaining = timerSec;
    setCountdown(remaining);
    countdownRef.current = setInterval(async () => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      setCountdown(null);
      await capturePhotoNow();
    }, 1000);
  };

  const handleVideoPress = async () => {
    if (busy && !recording) {
      return;
    }
    if (!sessionReady) {
      showToast('Camera starting…', 'hourglass-outline');
      return;
    }
    if (!recording) {
      setBusy(true);
      try {
        if (!(hasMic || (await requestMic()))) {
          throw new Error('Microphone permission required for video');
        }
        deactivateEngine();

        trackPointsRef.current = [];
        if (location) {
          trackPointsRef.current.push({
            lat: location.latitude,
            lng: location.longitude,
            t: Date.now(),
            accuracy: location.accuracy,
          });
        }
        clearLocationWatch(locationWatchRef.current);
        if (locationEnabled) {
          locationWatchRef.current = watchLocation(loc => {
            setLocation(loc);
            trackPointsRef.current.push({
              lat: loc.latitude,
              lng: loc.longitude,
              t: Date.now(),
              accuracy: loc.accuracy,
            });
          });
        }

        const recorder = await videoOutput.createRecorder({maxDuration: MAX_VIDEO_SECONDS});
        recorderRef.current = recorder;

        await recorder.startRecording(
          (filePath, reason) => {
            const durationMs = recordMsRef.current;
            recorderRef.current = null;
            setRecording(false);
            setBusy(true);
            clearLocationWatch(locationWatchRef.current);
            locationWatchRef.current = null;

            (async () => {
              try {
                if (durationMs < 500) {
                  showToast('Hold longer to record', 'information-circle-outline');
                  return;
                }
                await saveVideoToGallery(filePath);
                await uploadCapture(
                  filePath,
                  'VIDEO',
                  videoMimeType(filePath),
                  videoFileName(filePath),
                  durationMs > 0 ? durationMs : undefined,
                );
                const suffix = reason === 'max-duration-reached' ? ' (60s max)' : '';
                showToast(`Video saved${suffix}`);
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Save failed', 'alert-circle');
              } finally {
                setBusy(false);
              }
            })();
          },
          error => {
            setRecording(false);
            setBusy(false);
            recorderRef.current = null;
            clearLocationWatch(locationWatchRef.current);
            locationWatchRef.current = null;
            const message = error.message.includes('not yet connected')
              ? 'Camera still starting — try again'
              : error.message;
            showToast(message, 'alert-circle');
          },
        );
        setRecording(true);
        setBusy(false);
      } catch (error) {
        setRecording(false);
        setBusy(false);
        recorderRef.current = null;
        clearLocationWatch(locationWatchRef.current);
        locationWatchRef.current = null;
        const message =
          error instanceof Error && error.message.includes('not yet connected')
            ? 'Camera still starting — try again'
            : error instanceof Error
              ? error.message
              : 'Recording failed';
        showToast(message, 'alert-circle');
      }
      return;
    }
    setBusy(true);
    try {
      await recorderRef.current?.stopRecording();
    } catch (error) {
      setRecording(false);
      setBusy(false);
      recorderRef.current = null;
      showToast(error instanceof Error ? error.message : 'Stop failed', 'alert-circle');
    }
  };

  const handleModeChange = (next: CaptureMode) => {
    if (recording) {
      return;
    }
    setMode(next);
    if (next === 'video') {
      requestMic();
    }
  };

  const toggleLocation = async () => {
    if (!geotagFeatureEnabled) {
      showToast('Geotag disabled on server', 'location-outline');
      return;
    }
    if (locationEnabled) {
      setLocationEnabled(false);
      setLocation(undefined);
      setAddress(undefined);
      showToast('Location off', 'location-outline');
      return;
    }
    await refreshLocation();
    setLocationEnabled(true);
    showToast('Location on', 'location');
  };

  if (!device || !ready) {
    return (
      <View style={styles.loadingWrap}>
        <LinearGradient colors={['#1A1208', '#0F0F14']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={COLORS.camera} />
        <Text style={[styles.loadingText, {fontSize: layout.font.md}]}>Starting camera…</Text>
      </View>
    );
  }

  const locationLabel = !geotagFeatureEnabled
    ? 'Geotag off (server)'
    : locationEnabled
      ? address?.shortLabel ||
        (location
          ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
          : locating
            ? 'Getting GPS…'
            : 'Tap to enable location')
      : 'Location tagging off';

  const dockWidth = Math.min(layout.width - layout.hPad * 2, 420);
  const recordingInner = mode === 'video' && recording;

  return (
    <View style={styles.root}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused && ready}
        outputs={outputs}
        torchMode={flash === 'on' ? 'on' : 'off'}
        enableNativeTapToFocusGesture
        enableNativeZoomGesture
        onStarted={() => setSessionReady(true)}
        onStopped={() => setSessionReady(false)}
        onError={error => showToast(error.message, 'alert-circle')}
      />

      {/* Cinematic vignette */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={styles.vignetteTop}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.vignetteBottom}
      />

      {mode === 'video' && !recording ? (
        <View style={[styles.modeBadge, {top: layout.insets.top + layout.sideBtn + 20}]}>
          <Icon name="videocam" size={14} color={COLORS.camera} />
          <Text style={[styles.modeBadgeText, {fontSize: layout.font.xs}]}>VIDEO MODE</Text>
        </View>
      ) : null}

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.flashOverlay, {opacity: flashOverlay}]}
      />

      {showGrid ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {[0.33, 0.66].map(p => (
            <React.Fragment key={p}>
              <View style={[styles.gridLine, {top: `${p * 100}%`, left: 0, right: 0, height: 1}]} />
              <View style={[styles.gridLine, {left: `${p * 100}%`, top: 0, bottom: 0, width: 1}]} />
            </React.Fragment>
          ))}
        </View>
      ) : null}

      {countdown != null ? (
        <View style={styles.countdownWrap}>
          <Text style={[styles.countdownText, {fontSize: layout.font.hero}]}>{countdown}</Text>
        </View>
      ) : null}

      {liveMatch ? (
        <View style={styles.liveMatchBadge} pointerEvents="none">
          <GlassSurface padding={12} radius={RADIUS.lg} accent={COLORS.face}>
            <Text style={styles.liveMatchText}>
              {liveMatch.name} · {Math.round(liveMatch.confidence)}%
            </Text>
          </GlassSurface>
        </View>
      ) : null}

      {/* TOP BAR */}
      <View style={[styles.topBar, {paddingTop: layout.insets.top + 8, paddingHorizontal: layout.hPad}]}>
        <TouchableOpacity
          style={[styles.backBtn, {width: layout.iconBtn, height: layout.iconBtn, borderRadius: layout.iconBtn / 2}]}
          onPress={() => goToMediaTab()}
          hitSlop={8}>
          <Icon name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.thumbBtn, {width: layout.sideBtn, height: layout.sideBtn}]}
          onPress={() => navigation.navigate('CapturesGallery')}>
          {lastThumb ? (
            <Image source={{uri: lastThumb}} style={styles.thumbImg} />
          ) : (
            <Icon name="images-outline" size={20} color={COLORS.textSecondary} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.locationPill} onPress={toggleLocation} activeOpacity={0.85}>
          <GlassSurface padding={10} radius={RADIUS.xl} accent={locationEnabled ? COLORS.camera : undefined}>
            <View style={styles.locationRow}>
              <Icon
                name={locationEnabled ? 'location' : 'location-outline'}
                size={15}
                color={locationEnabled ? COLORS.camera : COLORS.textMuted}
              />
              <Text style={[styles.locationText, {fontSize: layout.font.sm}]} numberOfLines={1}>
                {locationLabel}
              </Text>
              {locating ? (
                <ActivityIndicator size="small" color={COLORS.camera} />
              ) : (
                <TouchableOpacity onPress={refreshLocation} hitSlop={10}>
                  <Icon name="refresh" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </GlassSurface>
        </TouchableOpacity>

        <IconTool
          icon="color-palette-outline"
          size={layout.iconBtn}
          onPress={openSettings}
        />
      </View>

      {recording ? (
        <View style={[styles.recBadge, {top: layout.insets.top + layout.sideBtn + 24}]}>
          <View style={styles.recDot} />
          <Text style={[styles.recTime, {fontSize: layout.font.sm}]}>{formatDurationMs(recordMs)}</Text>
        </View>
      ) : null}

      {/* BOTTOM DOCK */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
        style={[styles.bottomDock, {paddingBottom: layout.cameraBottom, paddingHorizontal: layout.hPad}]}>
        <View style={[styles.dockInner, {width: dockWidth}]}>
          <SegmentedControl
            options={[
              {value: 'photo' as const, label: 'Photo'},
              {value: 'video' as const, label: 'Video'},
            ]}
            value={mode}
            onChange={handleModeChange}
            accentColor={COLORS.camera}
            disabled={recording}
          />

          <View style={styles.shutterRow}>
            <IconTool
              icon="camera-reverse"
              label="Flip"
              size={layout.iconBtn}
              disabled={recording}
              onPress={() => !recording && setCameraPosition(p => (p === 'back' ? 'front' : 'back'))}
            />

            <TouchableOpacity
              disabled={(busy && !recording) || countdown != null}
              onPress={mode === 'photo' ? handlePhoto : handleVideoPress}
              activeOpacity={0.9}
              style={styles.shutterHit}>
              <Animated.View
                style={[
                  styles.shutterRing,
                  {
                    width: layout.shutterOuter,
                    height: layout.shutterOuter,
                    borderRadius: layout.shutterOuter / 2,
                    borderColor: mode === 'video' ? COLORS.camera : '#fff',
                    transform: recording ? [{scale: recordPulse}] : [],
                  },
                ]}>
                <View
                  style={[
                    styles.shutterFill,
                    {
                      width: recordingInner ? layout.shutterOuter * 0.34 : layout.shutterInner,
                      height: recordingInner ? layout.shutterOuter * 0.34 : layout.shutterInner,
                      borderRadius: recordingInner ? 8 : layout.shutterInner / 2,
                      backgroundColor: recordingInner ? COLORS.danger : '#fff',
                    },
                  ]}
                />
              </Animated.View>
            </TouchableOpacity>

            <IconTool
              icon={timerSec === 3 ? 'timer' : 'timer-outline'}
              label="Timer"
              active={timerSec === 3}
              accentColor={COLORS.camera}
              size={layout.iconBtn}
              onPress={() => !recording && setTimerSec(t => (t === 0 ? 3 : 0))}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolsScroll}
            bounces={false}>
            <ToolChip
              icon="grid-outline"
              label="Grid"
              active={showGrid}
              onPress={() => setShowGrid(v => !v)}
              fontSize={layout.font.xs}
            />
            <ToolChip
              icon="map-outline"
              label="Geo log"
              onPress={() => navigation.navigate('CapturesGallery')}
              fontSize={layout.font.xs}
            />
            <ToolChip
              icon={flash === 'on' ? 'flash' : 'flash-off'}
              label="Flash"
              active={flash === 'on'}
              onPress={() => setFlash(f => (f === 'off' ? 'on' : 'off'))}
              fontSize={layout.font.xs}
            />
            <ToolChip
              icon="scan"
              label={liveIdentify ? 'Face on' : 'Face ID'}
              active={liveIdentify}
              onPress={() => {
                setLiveIdentify(v => !v);
                if (liveIdentify) {
                  setLiveMatch(null);
                }
              }}
              fontSize={layout.font.xs}
            />
            <ToolChip
              icon={locationEnabled ? 'navigate' : 'navigate-outline'}
              label={locationEnabled ? 'GPS on' : 'GPS off'}
              active={locationEnabled}
              onPress={toggleLocation}
              fontSize={layout.font.xs}
            />
          </ScrollView>

          {busy && !recording ? (
            <View style={styles.savingRow}>
              <ActivityIndicator color={COLORS.camera} size="small" />
              <Text style={[styles.savingText, {fontSize: layout.font.sm}]}>Saving…</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>

      <ToastBanner
        visible={!!toast}
        message={toast?.message || ''}
        icon={toast?.icon}
        accentColor={COLORS.camera}
        bottomOffset={layout.cameraBottom + layout.shutterOuter + 48}
      />
    </View>
  );
}

function ToolChip({
  icon,
  label,
  active,
  onPress,
  fontSize,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress: () => void;
  fontSize: number;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}>
      <Icon name={icon} size={14} color={active ? '#fff' : COLORS.textSecondary} />
      <Text style={[styles.chipText, {fontSize}, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
  vignetteTop: {position: 'absolute', top: 0, left: 0, right: 0, height: 120, zIndex: 2},
  vignetteBottom: {position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, zIndex: 2},
  modeBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: `${COLORS.camera}55`,
  },
  modeBadgeText: {color: COLORS.camera, fontWeight: '800', letterSpacing: 0.6},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md},
  loadingText: {color: COLORS.textSecondary, fontWeight: '600'},
  flashOverlay: {backgroundColor: '#fff', zIndex: 10},
  gridLine: {position: 'absolute', backgroundColor: 'rgba(255,255,255,0.28)'},
  countdownWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  countdownText: {color: '#fff', fontWeight: '200'},
  liveMatchBadge: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    zIndex: 20,
  },
  liveMatchText: {color: COLORS.text, fontWeight: '800', fontSize: 14},
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,14,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  thumbBtn: {
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: 'rgba(14,14,20,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: {width: '100%', height: '100%'},
  locationPill: {flex: 1, minWidth: 0},
  locationRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  locationText: {flex: 1, color: COLORS.text, fontWeight: '700', minWidth: 0},
  recBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(220,40,60,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.lg,
    zIndex: 6,
  },
  recDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff'},
  recTime: {color: '#fff', fontWeight: '800', fontVariant: ['tabular-nums']},
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    paddingTop: 40,
    alignItems: 'center',
  },
  dockInner: {alignItems: 'center', gap: 16},
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  shutterHit: {alignItems: 'center', justifyContent: 'center'},
  shutterRing: {
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  shutterFill: {},
  toolsScroll: {gap: 8, paddingHorizontal: 4},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {backgroundColor: COLORS.camera, borderColor: COLORS.camera},
  chipText: {color: COLORS.textSecondary, fontWeight: '700'},
  chipTextActive: {color: '#fff'},
  savingRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  savingText: {color: COLORS.textSecondary, fontWeight: '600'},
});
