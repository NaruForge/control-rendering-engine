export const themes = {
    studio: { background: '#f7f9fc', panel: '#ffffff', ink: '#17283d', muted: '#6b7b90', line: '#d9e2ec', accent: '#137e79', tint: '#e8f5f1', violet: '#7550a0', violetTint: '#f2edf8', amber: '#a76115', amberTint: '#fff4e4', radius: 12 },
    midnight: { background: '#101b2b', panel: '#18283c', ink: '#edf4fb', muted: '#9bb0c8', line: '#33465e', accent: '#6cd8c1', tint: '#183d3e', violet: '#c4a4fa', violetTint: '#342949', amber: '#f0bc6f', amberTint: '#493b27', radius: 12 },
    paper: { background: '#ffffff', panel: '#ffffff', ink: '#161616', muted: '#5c5c5c', line: '#aaaaaa', accent: '#161616', tint: '#f0f0f0', violet: '#3a3a3a', violetTint: '#ededed', amber: '#414141', amberTint: '#f5f5f5', radius: 2 },
} as const;
export type ThemeName = keyof typeof themes;
export type Theme = {
    [K in keyof typeof themes.studio]: K extends 'radius' ? number : string;
};
