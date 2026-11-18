/** A user's theme choice: follow the OS, or pin light or dark. */
export type Theme = 'auto' | 'light' | 'dark';

/** The one localStorage key every admin uses for the theme choice. */
export declare const THEME_STORAGE_KEY: 'admin-theme';

/** Fired on `window` by setTheme(), with the new theme as `detail`. */
export declare const THEME_CHANGE_EVENT: 'admin-theme-change';

export declare const THEMES: readonly ['auto', 'light', 'dark'];

/** The stored choice, or 'auto' when nothing usable is stored. Never throws. */
export declare function readTheme(): Theme;

/** Pin or unpin the theme on <html> (or on `root`, for a nested scope). */
export declare function applyTheme(theme: Theme, root?: Element | null): void;

/**
 * Store the choice, apply it and fire THEME_CHANGE_EVENT. 'auto' clears the stored key.
 * Never throws; when storage fails, the choice holds for the rest of the page's life.
 */
export declare function setTheme(theme: Theme): Theme;

/** Apply the stored choice. Call it once, as early as possible, before the first paint. */
export declare function initTheme(): Theme;
