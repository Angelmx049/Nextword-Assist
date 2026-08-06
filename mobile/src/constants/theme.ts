export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
} as const;

export const borders = {
  thin: 1,
  strong: 2,
} as const;

export const fontSizes = {
  caption: 12,
  body: 15,
  label: 13,
  subtitle: 17,
  title: 24,
} as const;

export const shadows = {
  card: {
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
} as const;
