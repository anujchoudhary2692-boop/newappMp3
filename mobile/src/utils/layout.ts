import {useMemo} from 'react';
import {PixelRatio, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

/** Visual height of the bottom tab pill (excluding safe-area inset). */
export const TAB_BAR_VISUAL_HEIGHT = 62;
export const TAB_BAR_FLOAT_MARGIN = 10;
export const TAB_BAR_SIDE_MARGIN = 10;

export function tabBarVisualHeight(width: number): number {
  return rs(TAB_BAR_VISUAL_HEIGHT, width);
}

export function tabBarHeight(insetsBottom: number, width: number): number {
  return tabBarVisualHeight(width) + Math.max(insetsBottom, TAB_BAR_FLOAT_MARGIN);
}

/**
 * Total space occupied from the bottom edge by the floating tab bar.
 * Use as ScrollView paddingBottom / sceneContainerStyle paddingBottom.
 */
export function floatingTabBarInset(insetsBottom: number, width: number): number {
  const bottom = Math.max(insetsBottom, TAB_BAR_FLOAT_MARGIN);
  return bottom + tabBarVisualHeight(width) + rs(14, width);
}

/** Bottom offset for mini-player above floating tab bar. */
export function miniPlayerBottom(insetsBottom: number, width: number): number {
  return floatingTabBarInset(insetsBottom, width) + rs(4, width);
}

/** Scale relative to 390pt reference — allows more shrink on small phones. */
export function rs(size: number, width: number): number {
  const ratio = width / 390;
  const scaled = size * ratio;
  const min = size * (width < 360 ? 0.72 : width < 375 ? 0.76 : 0.78);
  const max = size * (width > 428 ? 1.14 : width > 768 ? 1.18 : 1.08);
  return Math.round(PixelRatio.roundToNearestPixel(Math.min(Math.max(scaled, min), max)));
}

/** Max readable content width — centers UI on tablets / landscape. */
export function contentMaxWidth(screenWidth: number): number {
  if (screenWidth >= 1024) {
    return 760;
  }
  if (screenWidth >= 768) {
    return 680;
  }
  return screenWidth;
}

/** Horizontal inset: edge padding on phones, centered column on tablets. */
export function horizontalContentInset(screenWidth: number, basePad: number): number {
  const maxW = contentMaxWidth(screenWidth);
  if (screenWidth <= maxW) {
    return basePad;
  }
  return Math.max(basePad, (screenWidth - maxW) / 2);
}

export function gridColumns(width: number): number {
  if (width >= 900) {
    return 4;
  }
  if (width >= 700) {
    return 3;
  }
  if (width < 340) {
    return 1;
  }
  return 2;
}

export function gridItemWidth(
  contentWidth: number,
  columns: number,
  gap: number,
): number {
  const totalGap = gap * (columns - 1);
  return (contentWidth - totalGap) / columns;
}

export function halfGridItemWidth(contentWidth: number, gap: number): number {
  return (contentWidth - gap) / 2;
}

export function featureCardWidth(
  contentWidth: number,
  gap: number,
  isSmallPhone: boolean,
): number {
  if (isSmallPhone || contentWidth < 340) {
    return contentWidth;
  }
  return halfGridItemWidth(contentWidth, gap);
}

export function useLayoutMetrics(tabBarVisible = true) {
  const {width, height} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const isSmallPhone = width < 360;
    const isCompact = width < 375 || height < 700;
    const isLargePhone = width >= 414 && width < 768;
    const isTablet = width >= 768;
    const isLandscape = width > height;
    const basePad = rs(isSmallPhone ? 12 : isTablet ? 20 : 16, width);
    const hPad = horizontalContentInset(width, basePad);
    const contentW = width - hPad * 2;
    const gap = rs(isSmallPhone ? 6 : 8, width);
    const cols = gridColumns(contentW);
    const floatInset = floatingTabBarInset(insets.bottom, width);
    const tabBar = tabBarVisible ? floatInset : 0;
    const tabH = tabBarVisualHeight(width);
    const artwork = rs(isCompact ? 100 : isTablet ? 144 : 120, width);
    const playBtn = rs(isCompact ? 46 : 52, width);
    const miniThumb = rs(isCompact ? 34 : 38, width);

    return {
      width,
      height,
      shortSide,
      longSide,
      insets,
      isSmallPhone,
      isCompact,
      isLargePhone,
      isTablet,
      isLandscape,
      tabBar,
      tabBarVisible,
      tabH,
      hPad,
      contentW,
      gap,
      gridColumns: cols,
      gridItemWidth: gridItemWidth(contentW, cols, gap),
      halfGridWidth: halfGridItemWidth(contentW, gap),
      featureCardWidth: featureCardWidth(contentW, gap, isSmallPhone),
      contentBottomPad: tabBarVisible ? floatInset + rs(8, width) : insets.bottom + rs(16, width),
      contentBottomPadWithPlayer: tabBarVisible
        ? floatInset + rs(72, width)
        : insets.bottom + rs(80, width),
      floatInset,
      miniPlayerBottom: miniPlayerBottom(insets.bottom, width),
      cameraBottom: tabBarVisible ? floatInset : insets.bottom + rs(20, width),
      screenBottom: tabBarVisible ? floatInset : insets.bottom + rs(24, width),
      shutterOuter: rs(isCompact ? 70 : 80, width),
      shutterInner: rs(isCompact ? 54 : 62, width),
      sideBtn: rs(isCompact ? 40 : 48, width),
      iconBtn: rs(isCompact ? 40 : 44, width),
      thumbSize: rs(isCompact ? 52 : isTablet ? 76 : 68, width),
      mediaHeight: Math.min(
        contentW,
        longSide * (isLandscape ? 0.55 : isCompact ? 0.42 : 0.48),
      ),
      videoStageHeight: Math.min(contentW * (9 / 16), longSide * (isLandscape ? 0.5 : 0.32)),
      artworkSize: artwork,
      artworkGlow: Math.round(artwork * 1.25),
      playBtnSize: playBtn,
      miniThumb,
      miniPlayBtn: rs(isCompact ? 30 : 34, width),
      miniIconBtn: rs(isCompact ? 28 : 32, width),
      headerBtn: rs(isCompact ? 34 : 38, width),
      actionCircle: rs(isCompact ? 36 : 44, width),
      emptyIcon: rs(isCompact ? 72 : 88, width),
      modalMaxWidth: Math.min(contentW, 420),
      font: {
        xs: rs(10, width),
        sm: rs(isSmallPhone ? 11 : 12, width),
        md: rs(isSmallPhone ? 13 : 14, width),
        lg: rs(isSmallPhone ? 15 : 17, width),
        xl: rs(isCompact ? 19 : isTablet ? 24 : 22, width),
        hero: rs(isCompact ? 56 : isTablet ? 80 : 72, width),
        lineSm: rs(16, width),
        lineMd: rs(20, width),
        lineLg: rs(24, width),
      },
    };
  }, [width, height, insets, tabBarVisible]);
}
