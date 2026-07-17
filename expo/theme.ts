// ============================================================================
// CortexBuild Pro — Design System
// Mirrors the web app (construction-confidence palette) with a complete,
// typed token set: color, typography, spacing, radius, elevation, and
// reusable component-style helpers. Import { Colors } for backward compat
// or the richer `Theme` object for new code.
// ============================================================================

// ── Color tokens ────────────────────────────────────────────────────────────
export const Colors = {
  // Surfaces (dark, blueprint ink-navy)
  ink: '#06101e', // app background
  ink2: '#0c1a30', // raised surface (sheets, tab bar)
  ink3: '#13243f', // card surface
  hair: '#22324d', // hairline borders
  // Accents
  amber: '#FFB000', // hi-vis primary accent
  blue: '#2D7FF9', // electric blue secondary
  purple: '#8B5CF6', // tertiary / info
  // Text
  t1: '#F4F8FF', // primary text
  t2: '#9FB2CC', // secondary text
  t3: '#5E718E', // muted text
  // Status / semantic
  red: '#FF5C5C',
  green: '#3DD68C',
  yellow: '#FFC53D',
  orange: '#FF8A3D',
} as const;

// Status → color map (reused by tickets, project pills, etc.)
export const StatusColor: Record<string, string> = {
  open: Colors.amber,
  in_progress: Colors.blue,
  progress: Colors.blue,
  resolved: Colors.green,
  closed: Colors.t3,
  paid: Colors.green,
  sent: Colors.blue,
  draft: Colors.t3,
  won: Colors.green,
  lost: Colors.red,
  done: Colors.green,
  high: Colors.red,
  med: Colors.orange,
  medium: Colors.orange,
  low: Colors.green,
};

// ── Typography ──────────────────────────────────────────────────────────────
export const Font = {
  // fontSize scale
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  // weights
  regular: '400' as const,
  medium: '600' as const,
  bold: '700' as const,
  black: '800' as const,
  // line heights
  tight: 20,
  normal: 22,
  relaxed: 26,
};

// ── Spacing scale (4pt grid) ────────────────────────────────────────────────
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

// ── Radius ──────────────────────────────────────────────────────────────────
export const Radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 20,
  pill: 999,
};

// ── Elevation (shadows) ─────────────────────────────────────────────────────
export const Elevation = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
};

// ── Aggregated theme object ──────────────────────────────────────────────────
export const Theme = {
  color: Colors,
  status: StatusColor,
  font: Font,
  space: Space,
  radius: Radius,
  elevation: Elevation,
};

export type ThemeType = typeof Theme;
export type ColorToken = keyof typeof Colors;

// ── Shared style helpers (reduce repetition across screens) ──────────────────
import { StyleSheet } from 'react-native';

export const Common = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.ink },
  screenPad: { flex: 1, backgroundColor: Colors.ink, padding: Space.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.lg,
  },
  h1: { color: Colors.t1, fontSize: Font.xxl, fontWeight: Font.bold },
  h2: { color: Colors.t1, fontSize: Font.xl, fontWeight: Font.bold },
  card: {
    backgroundColor: Colors.ink3,
    borderWidth: 1,
    borderColor: Colors.hair,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginBottom: Space.md,
  },
  cardText: { color: Colors.t1, fontSize: Font.lg, fontWeight: Font.medium },
  cardSub: { color: Colors.t2, fontSize: Font.sm, marginTop: 2 },
  input: {
    backgroundColor: Colors.ink3,
    borderWidth: 1,
    borderColor: Colors.hair,
    borderRadius: Radius.lg,
    padding: Space.lg,
    color: Colors.t1,
    fontSize: Font.base,
  },
  primaryBtn: {
    backgroundColor: Colors.amber,
    borderRadius: Radius.xl,
    padding: Space.lg,
    alignItems: 'center',
    marginTop: Space.sm,
  },
  primaryBtnText: { color: Colors.ink, fontSize: Font.base, fontWeight: Font.bold },
  danger: { color: Colors.red },
  center: {
    flex: 1,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// API base URL (kept here so api.ts can import it)
export const API_URL = 'https://cortexbuildpro.com';
