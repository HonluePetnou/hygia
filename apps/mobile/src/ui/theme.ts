/** Design system HYGIA : mêmes couleurs que le web (`apps/web/src/app/globals.css`). */
export const colors = {
  primary: '#0e7c6b',
  primarySoft: '#e3f3ef',
  ink: '#0b1b2b',
  bg: '#f3f5f7',
  surface: '#ffffff',
  border: '#e2e7ec',
  text: '#0b1b2b',
  textMuted: '#566676',
  textSubtle: '#6b7886',
  danger: '#d23f3f',
  warning: '#c9821a',
  warningSoft: '#fdf3e2',
  warningText: '#8a5a0f',
  success: '#178a5b',
  successSoft: '#e4f5ec',
  successText: '#0f6b45',
} as const;

/** Familles de Plus Jakarta Sans chargées par `expo-font`. */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Familles de badge : fond, texte. */
export const badgeTones = {
  success: { background: colors.successSoft, color: colors.successText },
  warning: { background: colors.warningSoft, color: colors.warningText },
  danger: { background: '#fdecec', color: '#a52b2b' },
} as const;

export type BadgeTone = keyof typeof badgeTones;
