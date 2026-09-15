export const themes = {
  studio: { background: '#f7f8fb', panel: '#ffffff', ink: '#192639', muted: '#627184', line: '#dce3eb', accent: '#147d80', tint: '#e9f5f3', second: '#7252a3', secondTint: '#f1ecf8', power: '#53657c', radius: 14 },
  midnight: { background: '#111a28', panel: '#1a2637', ink: '#eff4fb', muted: '#a7b7cd', line: '#34465c', accent: '#65d9c0', tint: '#173e3d', second: '#c0a0f2', secondTint: '#322647', power: '#b4c5d9', radius: 14 },
  paper: { background: '#ffffff', panel: '#ffffff', ink: '#121212', muted: '#4c4c4c', line: '#a6a6a6', accent: '#111111', tint: '#eeeeee', second: '#333333', secondTint: '#f5f5f5', power: '#242424', radius: 2 },
} as const;
export type ThemeName = keyof typeof themes;
export type Theme = { [K in keyof typeof themes.studio]: K extends 'radius' ? number : string };
