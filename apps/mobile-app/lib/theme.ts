export const palette = {
  ink: '#071D49',
  graphite: '#162B52',
  navy: '#071D49',
  navySoft: '#EAF1F8',
  blue: '#174EA6',
  blueSoft: '#EAF3FF',
  blueMist: '#F4F8FF',
  cyan: '#0EAFC8',
  cyanSoft: '#E6FAFD',
  emerald: '#10A66F',
  emeraldSoft: '#E8F8F0',
  amber: '#C98918',
  amberSoft: '#FFF6E8',
  orange: '#D97912',
  coral: '#E5484D',
  coralSoft: '#FDEEEF',
  violet: '#6257D7',
  violetSoft: '#F0EEFF',
  slate: '#5C6878',
  muted: '#8793A5',
  line: '#E0E7F0',
  lineStrong: '#C6D3E1',
  canvas: '#F4F8FC',
  canvasWarm: '#FAF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FBFF',
  glass: 'rgba(255,255,255,0.86)',
};

export const colors = {
  navy: palette.ink,
  navySoft: palette.navySoft,
  green: palette.emerald,
  grey: palette.slate,
  lightGrey: palette.canvas,
  border: palette.line,
  white: palette.surface,
  danger: palette.coral,
  blue: palette.blue,
  amber: palette.amber,
  violet: palette.violet,
};

export const roleTheme = {
  customer: { accent: palette.navy, soft: palette.blueSoft, icon: 'truck-check-outline' },
  ops: { accent: palette.blue, soft: palette.blueSoft, icon: 'clipboard-pulse-outline' },
  agent: { accent: palette.cyan, soft: palette.cyanSoft, icon: 'account-tie-voice-outline' },
  management: { accent: palette.violet, soft: palette.violetSoft, icon: 'chart-timeline-variant' },
  it: { accent: palette.navy, soft: palette.navySoft, icon: 'shield-account-outline' },
} as const;

export const radii = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};
