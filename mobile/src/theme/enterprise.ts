import {COLORS, RADIUS, SHADOW, SPACING} from '../config';

/** Amazon-inspired enterprise layout tokens */
export const ENTERPRISE = {
  headerBg: '#131921',
  headerBorder: '#232F3E',
  searchBg: '#232F3E',
  searchBorder: '#37475A',
  pageBg: '#0F1117',
  cardBg: '#161D26',
  cardBorder: '#232F3E',
  divider: '#232F3E',
  brand: '#FF9900',
  brandDark: '#E88B00',
  link: '#007185',
  success: '#067D62',
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 24,
  },
  catalog: {
    cardWidth: 148,
    imageHeight: 148,
    bannerHeight: 168,
  },
};

export const enterpriseStyles = {
  page: {
    flex: 1,
    backgroundColor: ENTERPRISE.pageBg,
  },
  section: {
    backgroundColor: ENTERPRISE.cardBg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: ENTERPRISE.divider,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: ENTERPRISE.cardBg,
    borderRadius: ENTERPRISE.radius.md,
    borderWidth: 1,
    borderColor: ENTERPRISE.cardBorder,
    ...SHADOW.sm,
  },
};

export function enterpriseHeaderHeight(insetsTop: number): number {
  return insetsTop + 56;
}
