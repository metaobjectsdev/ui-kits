// The shared theme contract in a few lines of plain JavaScript, so React apps and
// server-rendered pages apply it the same way.
//
//   <html data-theme="light|dark"> pins the theme; no attribute follows the OS.
//   The user's choice lives under one storage key, read and written inside try/catch
//   because storage can throw (private windows, blocked site data, sandboxed frames).

export const THEME_STORAGE_KEY = 'admin-theme';

/** Fired on `window` by setTheme(), with the new theme as `detail`, so every toggle on the page follows. */
export const THEME_CHANGE_EVENT = 'admin-theme-change';

/** @type {readonly ['auto', 'light', 'dark']} */
export const THEMES = ['auto', 'light', 'dark'];

function isTheme(value) {
  return value === 'auto' || value === 'light' || value === 'dark';
}

// The choice made on this page when storage could not hold it.
let unstored = null;

/** The stored choice, or 'auto' when nothing usable is stored. */
export function readTheme() {
  if (unstored) return unstored;
  try {
    const value = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** Pin or unpin the theme on <html> (or on `root`, for a nested scope). */
export function applyTheme(theme, root = globalThis.document?.documentElement) {
  if (!root) return;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
}

/** Store the choice and apply it. 'auto' clears the stored key. */
export function setTheme(theme) {
  const next = isTheme(theme) ? theme : 'auto';
  try {
    if (next === 'auto') globalThis.localStorage?.removeItem(THEME_STORAGE_KEY);
    else globalThis.localStorage?.setItem(THEME_STORAGE_KEY, next);
    unstored = null;
  } catch {
    // Storage is unavailable: the choice still applies to this page.
    unstored = next;
  }
  applyTheme(next);
  if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: next }));
  }
  return next;
}

/** Apply the stored choice. Call it once, as early as possible, before the first paint. */
export function initTheme() {
  const theme = readTheme();
  applyTheme(theme);
  return theme;
}
