/**
 * Design tokens — warm, premium, human.
 * Brand: parchment backgrounds, gold/orange accents, AG Book Rounded + Poppins typography.
 *
 * Import from this file everywhere. Never hardcode colours inline.
 */

// ─── Brand palette ────────────────────────────────────────────────────────────

export const palette = {
  background: '#F4EFCF',
  backgroundSecondary: '#F2DEB0',
  accentYellow: '#FFD93D',
  accentOrangeLight: '#FFB66C',
  accentOrange: '#FF8400',
  textPrimary: '#2E2E2E',
  textSecondary: '#6E6E6E',
} as const;

// ─── Font families ────────────────────────────────────────────────────────────

export const fonts = {
  /**
   * Main display titles, capacity score number.
   * To use AGBookRounded-Bold: add AGBookRounded-Bold.ttf to assets/fonts/,
   * load it in app/_layout.tsx via useFonts, then change this to 'AGBookRounded-Bold'.
   */
  display: 'Poppins_500Medium',
  /** Button labels, card titles, important UI labels */
  bodyMedium: 'Poppins_500Medium',
  /** Body text, descriptions */
  bodyRegular: 'Poppins_400Regular',
  /** Secondary content, meta text, labels */
  bodyLight: 'Poppins_300Light',
} as const;

// ─── Colour tokens ────────────────────────────────────────────────────────────

export const colors = {
  /* Brand accents */
  brandGold: palette.accentYellow,
  brandOrange: palette.accentOrangeLight,
  danger: '#E8534A',

  /* Background */
  bg: {
    canvas: palette.background,
    canvasAlt: palette.backgroundSecondary,
  },

  /* Ink */
  ink: {
    primary: palette.textPrimary,
    secondary: palette.textSecondary,
    tertiary: 'rgba(46, 46, 46, 0.50)',
    placeholder: 'rgba(46, 46, 46, 0.34)',
  },

  /* Dividers */
  divider: {
    subtle: 'rgba(46, 46, 46, 0.07)',
    hairline: 'rgba(46, 46, 46, 0.10)',
    strong: 'rgba(46, 46, 46, 0.14)',
  },

  /* Surfaces — warm parchment based */
  surface: {
    card: 'rgba(255, 255, 255, 0.84)',
    cardStrong: 'rgba(255, 255, 255, 0.94)',
    cardBorder: 'rgba(46, 46, 46, 0.10)',
    sheet: 'rgba(255, 252, 244, 0.97)',
    sheetBorder: 'rgba(46, 46, 46, 0.12)',
  },

  /* Controls */
  control: {
    fieldBg: 'rgba(255, 255, 255, 0.72)',
    fieldBorder: 'rgba(46, 46, 46, 0.14)',
    fieldFocus: 'rgba(255, 217, 61, 0.52)',
    chipBg: 'rgba(46, 46, 46, 0.05)',
    chipBorder: 'rgba(46, 46, 46, 0.09)',
  },

  /* Legacy aliases */
  primaryYellow: palette.accentYellow,
  orange: palette.accentOrange,
  coral: '#E8534A',
  deepNavy: '#221E18',
  steelBlue: '#3A332B',
  backgroundPrimary: palette.background,
  backgroundSecondary: palette.backgroundSecondary,
  offWhite: palette.background,
  bodyText: palette.textPrimary,
  textPrimary: palette.textPrimary,
  textSecondary: palette.textSecondary,
  textTertiary: 'rgba(46, 46, 46, 0.50)',
  placeholder: 'rgba(46, 46, 46, 0.34)',
  onDarkText: 'rgba(255, 255, 255, 0.95)',
  onDarkSecondary: 'rgba(255, 255, 255, 0.60)',
  onDarkTertiary: 'rgba(255, 255, 255, 0.40)',
  glassBorder: 'rgba(46, 46, 46, 0.14)',
  glassBorderLight: 'rgba(46, 46, 46, 0.20)',
  glassBorderSubtle: 'rgba(46, 46, 46, 0.08)',
  inputBg: 'rgba(255, 255, 255, 0.72)',
  inputBorder: 'rgba(46, 46, 46, 0.18)',
  inputFocusBorder: 'rgba(255, 217, 61, 0.52)',
  secondaryButtonBg: 'rgba(46, 46, 46, 0.06)',
  secondaryButtonBorder: 'rgba(46, 46, 46, 0.18)',
  tabBarBg: palette.background,
  tabBarBorder: 'rgba(46, 46, 46, 0.12)',
  activePillBg: 'rgba(255, 217, 61, 0.18)',
  headerBarBg: 'transparent',
  tabBarTintBg: palette.background,
  headerBarBorder: 'rgba(46, 46, 46, 0.06)',
  tabBarTintBorder: 'rgba(46, 46, 46, 0.10)',
  sheetBg: palette.backgroundSecondary,
  overlay: 'rgba(46, 46, 46, 0.40)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const borderRadius = {
  pill: 999,
  card: 12,
  cardSm: 10,
  button: 14,
  buttonSm: 10,
  input: 12,
  chip: 999,
  tabBar: 24,
} as const;

export const typography = {
  display: { fontSize: 34, lineHeight: 38, fontWeight: '700' as const, letterSpacing: -0.5 },
  sectionHeader: { fontSize: 22, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.2 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const, letterSpacing: 0 },
  caption: { fontSize: 13, lineHeight: 17, fontWeight: '400' as const, letterSpacing: 0.1 },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
} as const;

export const layout = {
  screenPaddingX: 16,
  cardPadding: 16,
  cardGap: 12,
  tapMin: 44,
} as const;

/** Shared card shadow — warm and barely-there. */
export const cardShadow = {
  shadowColor: '#2E2E2E',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.10,
  shadowRadius: 10,
  elevation: 3,
} as const;
