import { useEffect, useSyncExternalStore } from 'react';
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyTheme,
  initTheme,
  readTheme,
  setTheme,
  type Theme,
} from '@metaobjectsdev/admin-tokens/theme';
import { SegmentedControl } from './controls.js';

export { THEME_CHANGE_EVENT, THEME_STORAGE_KEY, applyTheme, initTheme, readTheme, setTheme, type Theme };

// One store for the whole page: setTheme() fires THEME_CHANGE_EVENT in this tab, and the
// storage event carries a change made in another tab.
function subscribe(notify: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyTheme(readTheme());
    notify();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, notify);
  };
}

// The server cannot read storage, so it renders 'auto'; hydration then moves to the stored choice.
const serverTheme = (): Theme => 'auto';

/**
 * The user's theme choice, kept in step with <html data-theme> and the `admin-theme`
 * storage key. Every toggle on the page shows the same value, and a change made in another
 * tab is followed.
 */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  // Apply the stored choice on mount, for apps that did not call initTheme() first.
  useEffect(() => {
    initTheme();
  }, []);
  return [theme, setTheme];
}

const OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/** Auto / Light / Dark. Auto follows the operating system. */
export function ThemeToggle({ label = 'Theme' }: { label?: string }) {
  const [theme, setTheme] = useTheme();
  return <SegmentedControl label={label} options={OPTIONS} value={theme} onChange={setTheme} />;
}
