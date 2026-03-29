export const theme = {
  primary: 'cyan',
  secondary: 'white',
  muted: 'gray',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  accent: 'blue',
  selected: 'cyan',
  border: 'gray',
} as const;

export type ThemeColor = typeof theme[keyof typeof theme];
