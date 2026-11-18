import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx.js';
import { trapTab } from './drawer.js';
import { SearchIcon } from './icons.js';

export interface CommandItem {
  id: string;
  label: string;
  /** Heading the item is listed under, such as "Pages" or "People". */
  group?: string;
  /** A second line or a right-hand note. */
  hint?: string;
  /** Extra words the filter matches, such as an area name. */
  keywords?: string;
}

export interface CommandPaletteProps {
  /** Items always available, filtered by the typed text: the page list, quick actions. */
  items?: ReadonlyArray<CommandItem>;
  /** Finds more items for the typed text (a search operation). Only the latest answer shows. */
  search?: (query: string, signal: AbortSignal) => Promise<ReadonlyArray<CommandItem>>;
  onSelect: (item: CommandItem) => void;
  /** Controlled open state. Leave unset to let the hotkeys and `openPalette` drive it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** `/` and Ctrl+K (⌘K) open the palette when focus is not in a text field. Default true. */
  hotkeys?: boolean;
  label?: string;
  placeholder?: string;
  empty?: ReactNode;
  'data-testid'?: string;
}

/** True while focus is somewhere that types text, where a bare `/` must not be stolen. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(target.type);
  return false;
}

/** Filters items by every typed word, ranking labels that start with the text first. */
export function filterCommands(items: ReadonlyArray<CommandItem>, query: string): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  const words = q.split(/\s+/);
  const hits = items.filter((item) => {
    const hay = `${item.label} ${item.group ?? ''} ${item.keywords ?? ''}`.toLowerCase();
    return words.every((word) => hay.includes(word));
  });
  return hits.sort((a, b) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q)));
}

/**
 * Search everything from one box: the app's pages and quick actions, plus results from a
 * search call. `/` or Ctrl+K opens it, arrow keys move, Enter picks, Esc closes and focus
 * returns where it was.
 */
export function CommandPalette({
  items = [],
  search,
  onSelect,
  open: openProp,
  onOpenChange,
  hotkeys = true,
  label = 'Search',
  placeholder = 'Search pages and records…',
  empty = 'No matches',
  'data-testid': testId,
}: CommandPaletteProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ReadonlyArray<CommandItem>>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [active, setActive] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<Element | null>(null);
  const request = useRef<AbortController | null>(null);
  const listId = useId();
  const searchRef = useRef(search);
  searchRef.current = search;

  const setOpen = (next: boolean) => {
    if (openProp == null) setOwnOpen(next);
    onOpenChange?.(next);
  };
  const latestSetOpen = useRef(setOpen);
  latestSetOpen.current = setOpen;

  useEffect(() => {
    if (!hotkeys) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const k = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey);
      const slash = event.key === '/' && !event.ctrlKey && !event.metaKey && !isTyping(event.target);
      if (!k && !slash) return;
      if (document.querySelector('dialog[open]') && !dialog.current?.open) return;
      event.preventDefault();
      latestSetOpen.current(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hotkeys]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      opener.current = document.activeElement;
      setQuery('');
      setFound([]);
      setStatus('idle');
      setActive(0);
      node.showModal();
      input.current?.focus();
    } else if (!open && node.open) {
      node.close();
      request.current?.abort();
      const back = opener.current;
      opener.current = null;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    }
  }, [open]);

  // Remote results, latest request wins.
  useEffect(() => {
    request.current?.abort();
    const q = query.trim();
    if (!open || !searchRef.current || !q) {
      setFound([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setStatus('loading');
    const timer = setTimeout(() => {
      searchRef.current?.(q, controller.signal).then(
        (result) => {
          if (controller.signal.aborted) return;
          setFound(result);
          setStatus('idle');
        },
        () => {
          if (controller.signal.aborted) return;
          setFound([]);
          setStatus('error');
        },
      );
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const results = [...filterCommands(items, query), ...found.filter((item) => !items.some((own) => own.id === item.id))];
  const current = Math.min(active, Math.max(0, results.length - 1));

  const choose = (item: CommandItem) => {
    setOpen(false);
    onSelect(item);
  };

  let lastGroup: string | undefined;
  return (
    <dialog
      ref={dialog}
      className="ak-palette"
      aria-label={label}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        setOpen(false);
      }}
      onClose={() => {
        if (open) setOpen(false);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (dialog.current) trapTab(event, dialog.current);
      }}
    >
      <div className="ak-palette-box">
        <div className="ak-palette-search">
          <SearchIcon />
          <input
            ref={input}
            className="ak-palette-input"
            role="combobox"
            aria-label={label}
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
            placeholder={placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (!results.length) return;
                const step = event.key === 'ArrowDown' ? 1 : -1;
                setActive((current + step + results.length) % results.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const item = results[current];
                if (item) choose(item);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
              }
            }}
          />
          <kbd className="ak-kbd">Esc</kbd>
        </div>
        <ul className="ak-palette-list" id={listId} role="listbox" aria-label={label}>
          {results.map((item, index) => {
            const heading = item.group !== lastGroup && item.group ? item.group : null;
            lastGroup = item.group;
            return [
              heading && (
                <li key={`g-${heading}-${index}`} className="ak-palette-group" role="presentation">
                  {heading}
                </li>
              ),
              <li
                key={item.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === current}
                className={cx('ak-palette-item', index === current && 'ak-palette-active')}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
              >
                <span>{item.label}</span>
                {item.hint && <span className="ak-palette-hint">{item.hint}</span>}
              </li>,
            ];
          })}
          {status === 'loading' && (
            <li className="ak-palette-note" role="presentation">
              Searching…
            </li>
          )}
          {status === 'error' && (
            <li className="ak-palette-note ak-palette-error" role="presentation">
              Search failed; showing pages only.
            </li>
          )}
          {status === 'idle' && results.length === 0 && (
            <li className="ak-palette-note" role="presentation">
              {empty}
            </li>
          )}
        </ul>
      </div>
    </dialog>
  );
}
