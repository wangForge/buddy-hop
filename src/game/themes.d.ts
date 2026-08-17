export type Theme = {
  id: string;
  name: string;
  preview: string;
  sceneSvg?: string;
};

export const DEFAULT_THEME_ID: string;
export const THEMES: Theme[];
export const getThemeById: (id: unknown) => Theme;
export const getInitialThemeId: () => string;
export const hasExplicitThemeParam: () => boolean;
export const applyTheme: (id: string) => void;
export const getStoredThemeId: () => Promise<string>;
export const saveStoredThemeId: (id: string) => Promise<void>;
export const watchStoredTheme: (callback: (id: string) => void) => () => void;
