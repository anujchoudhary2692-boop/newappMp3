export type ThemeId = 'violet' | 'ocean' | 'sunset' | 'rose' | 'mint';

export interface AppThemeColors {
  background: string;
  surface: string;
  surfaceLight: string;
  primary: string;
  primaryDark: string;
  accent: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  danger: string;
  success: string;
  warning: string;
  audio: string;
  video: string;
  face: string;
  camera: string;
}

export interface AppThemeGradients {
  media: [string, string];
  face: [string, string];
  playerAudio: [string, string, string];
  playerVideo: [string, string, string];
  camera: [string, string, string];
}

export interface AppTheme {
  id: ThemeId;
  name: string;
  swatch: string;
  colors: AppThemeColors;
  gradients: AppThemeGradients;
}

/** Premium palettes — high contrast, distinct feature colors */
export const THEMES: Record<ThemeId, AppTheme> = {
  violet: {
    id: 'violet',
    name: 'Enterprise',
    swatch: '#FF9900',
    colors: {
      background: '#0F1117',
      surface: '#161D26',
      surfaceLight: '#232F3E',
      primary: '#FF9900',
      primaryDark: '#E88B00',
      accent: '#007185',
      text: '#FFFFFF',
      textSecondary: '#C7CED4',
      textMuted: '#879596',
      border: '#232F3E',
      danger: '#FF4D6A',
      success: '#067D62',
      warning: '#FBBF24',
      audio: '#FF9900',
      video: '#FF6B9D',
      face: '#34D399',
      camera: '#FF9F43',
    },
    gradients: {
      media: ['#131921', '#0F1117'],
      face: ['#131921', '#0F1117'],
      playerAudio: ['#101830', '#0A1020', '#08080E'],
      playerVideo: ['#201028', '#120818', '#08080E'],
      camera: ['#201408', '#100804', '#08080E'],
    },
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    swatch: '#38BDF8',
    colors: {
      background: '#060A12',
      surface: '#0F1724',
      surfaceLight: '#182030',
      primary: '#38BDF8',
      primaryDark: '#0EA5E9',
      accent: '#2DD4BF',
      text: '#F0F9FF',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      border: '#1E3048',
      danger: '#FB7185',
      success: '#2DD4BF',
      warning: '#FCD34D',
      audio: '#38BDF8',
      video: '#818CF8',
      face: '#2DD4BF',
      camera: '#22D3EE',
    },
    gradients: {
      media: ['#0C1A30', '#060A12'],
      face: ['#082820', '#060A12'],
      playerAudio: ['#0C2038', '#081828', '#060A12'],
      playerVideo: ['#101838', '#081028', '#060A12'],
      camera: ['#082838', '#061820', '#060A12'],
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    swatch: '#FB923C',
    colors: {
      background: '#0E0A08',
      surface: '#1A1410',
      surfaceLight: '#282018',
      primary: '#FB923C',
      primaryDark: '#EA580C',
      accent: '#FACC15',
      text: '#FFF7ED',
      textSecondary: '#D6C4B0',
      textMuted: '#8A7868',
      border: '#3A2E24',
      danger: '#F87171',
      success: '#FACC15',
      warning: '#FDE047',
      audio: '#FB923C',
      video: '#F472B6',
      face: '#FACC15',
      camera: '#FB923C',
    },
    gradients: {
      media: ['#281008', '#0E0A08'],
      face: ['#201008', '#0E0A08'],
      playerAudio: ['#301008', '#180804', '#0E0A08'],
      playerVideo: ['#301028', '#180818', '#0E0A08'],
      camera: ['#301808', '#180C04', '#0E0A08'],
    },
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    swatch: '#F472B6',
    colors: {
      background: '#0C080C',
      surface: '#181018',
      surfaceLight: '#241824',
      primary: '#F472B6',
      primaryDark: '#DB2777',
      accent: '#A78BFA',
      text: '#FDF4FF',
      textSecondary: '#C4A8C4',
      textMuted: '#806880',
      border: '#342834',
      danger: '#FB7185',
      success: '#A78BFA',
      warning: '#FBBF24',
      audio: '#F472B6',
      video: '#FB7185',
      face: '#A78BFA',
      camera: '#FDA4AF',
    },
    gradients: {
      media: ['#280818', '#0C080C'],
      face: ['#201028', '#0C080C'],
      playerAudio: ['#280818', '#180810', '#0C080C'],
      playerVideo: ['#301020', '#180818', '#0C080C'],
      camera: ['#280810', '#140408', '#0C080C'],
    },
  },
  mint: {
    id: 'mint',
    name: 'Emerald',
    swatch: '#10B981',
    colors: {
      background: '#060E0A',
      surface: '#0E1814',
      surfaceLight: '#162420',
      primary: '#10B981',
      primaryDark: '#059669',
      accent: '#6366F1',
      text: '#ECFDF5',
      textSecondary: '#A7C4B8',
      textMuted: '#608878',
      border: '#1E3830',
      danger: '#F87171',
      success: '#10B981',
      warning: '#FBBF24',
      audio: '#10B981',
      video: '#34D399',
      face: '#10B981',
      camera: '#2DD4BF',
    },
    gradients: {
      media: ['#082018', '#060E0A'],
      face: ['#082018', '#060E0A'],
      playerAudio: ['#0A2820', '#061810', '#060E0A'],
      playerVideo: ['#0A3028', '#061818', '#060E0A'],
      camera: ['#082820', '#061810', '#060E0A'],
    },
  },
};

export const THEME_LIST = Object.values(THEMES);

export const DEFAULT_THEME_ID: ThemeId = 'violet';
