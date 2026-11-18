import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';

/**
 * Where filter, period, selected-item and drawer state live in the address. The kit has no
 * router dependency: an app picks one of the two adapters below or writes its own.
 */
export interface UrlAdapter {
  /** The current query. */
  read(): URLSearchParams;
  /** Writes a new query. `push` adds a history entry; `replace` (typing in a search box) does not. */
  write(params: URLSearchParams, mode: 'push' | 'replace'): void;
  /** Calls `listener` when the query changes from outside (back, forward, a link). Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

const URL_CHANGE_EVENT = 'admin-url-change';

function notify() {
  window.dispatchEvent(new Event(URL_CHANGE_EVENT));
}

function listen(events: string[], listener: () => void) {
  for (const name of events) window.addEventListener(name, listener);
  return () => {
    for (const name of events) window.removeEventListener(name, listener);
  };
}

/** The query in `location.search`, written with history.pushState/replaceState. */
export const searchParamsAdapter: UrlAdapter = {
  read: () => new URLSearchParams(window.location.search),
  write(params, mode) {
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (mode === 'push') window.history.pushState(window.history.state, '', url);
    else window.history.replaceState(window.history.state, '', url);
    notify();
  },
  subscribe: (listener) => listen(['popstate', URL_CHANGE_EVENT], listener),
};

/** The query inside the hash, for hash-routed apps: `#/area/page?status=open`. */
export const hashParamsAdapter: UrlAdapter = {
  read() {
    const hash = window.location.hash;
    const at = hash.indexOf('?');
    return new URLSearchParams(at < 0 ? '' : hash.slice(at + 1));
  },
  write(params, mode) {
    const hash = window.location.hash || '#';
    const at = hash.indexOf('?');
    const path = at < 0 ? hash : hash.slice(0, at);
    const query = params.toString();
    const url = `${window.location.pathname}${window.location.search}${path}${query ? `?${query}` : ''}`;
    if (mode === 'push') window.history.pushState(window.history.state, '', url);
    else window.history.replaceState(window.history.state, '', url);
    notify();
  },
  subscribe: (listener) => listen(['popstate', 'hashchange', URL_CHANGE_EVENT], listener),
};

const AdapterContext = createContext<UrlAdapter>(searchParamsAdapter);

/** Sets the adapter every URL-bound kit control below it uses. The default is searchParamsAdapter. */
export function UrlStateProvider({ adapter, children }: { adapter: UrlAdapter; children: ReactNode }) {
  return <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>;
}

export function useUrlAdapter(): UrlAdapter {
  return useContext(AdapterContext);
}

/**
 * Several query parameters at once. Returns their current values (null when absent) and a
 * setter that changes some of them, leaving every other parameter in the address alone.
 * A value equal to its default, null or '' is removed, so the plain address is the default view.
 */
export function useUrlParams<K extends string>(
  names: readonly K[],
  { defaults, adapter: given }: { defaults?: Partial<Record<K, string>>; adapter?: UrlAdapter } = {},
): [Record<K, string | null>, (changes: Partial<Record<K, string | null>>, mode?: 'push' | 'replace') => void] {
  const context = useUrlAdapter();
  const adapter = given ?? context;
  // The snapshot is JSON, not a query string: a value holding `&`, `+` or `%` must survive the
  // round trip through the store unchanged.
  const readSnapshot = () => JSON.stringify(names.map((name) => adapter.read().get(name) ?? ''));
  const key = readSnapshot();
  const snapshot = useSyncExternalStore(adapter.subscribe, readSnapshot, () => key);
  const current = JSON.parse(snapshot) as string[];
  const values = {} as Record<K, string | null>;
  names.forEach((name, i) => {
    const raw = current[i] ?? '';
    values[name] = raw ? raw : (defaults?.[name] ?? null);
  });
  const setValues = useCallback(
    (changes: Partial<Record<K, string | null>>, mode: 'push' | 'replace' = 'push') => {
      const next = adapter.read();
      for (const [name, value] of Object.entries(changes) as Array<[K, string | null | undefined]>) {
        if (value == null || value === '' || value === defaults?.[name]) next.delete(name);
        else next.set(name, value);
      }
      if (next.toString() !== adapter.read().toString()) adapter.write(next, mode);
    },
    // Keyed on the defaults' content: callers pass a fresh object each render.
    [adapter, JSON.stringify(defaults ?? {})],
  );
  return [values, setValues];
}

/** One query parameter: `[value, setValue]`, with `defaultValue` when the address has none. */
export function useUrlParam(
  name: string,
  { defaultValue, adapter }: { defaultValue?: string; adapter?: UrlAdapter } = {},
): [string | null, (value: string | null, mode?: 'push' | 'replace') => void] {
  const [values, setValues] = useUrlParams([name], { defaults: defaultValue == null ? undefined : { [name]: defaultValue }, adapter });
  const set = useCallback((value: string | null, mode?: 'push' | 'replace') => setValues({ [name]: value }, mode), [name, setValues]);
  return [values[name] ?? null, set];
}
