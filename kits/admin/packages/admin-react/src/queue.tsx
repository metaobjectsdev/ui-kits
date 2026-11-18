import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './controls.js';
import { cx, has } from './cx.js';
import { FilterSegment, type FilterOption } from './filters.js';
import { isTyping } from './palette.js';
import { Alert, EmptyState } from './status.js';

export interface QueueAction {
  id: string;
  label: ReactNode;
  tone?: 'primary' | 'secondary' | 'danger';
  /** Runs the action. When it resolves the queue moves to the next item; a rejection stays put and shows its message. */
  run: () => unknown;
  disabled?: boolean;
}

export interface QueueLayoutProps<Item> {
  items: ReadonlyArray<Item>;
  itemId: (item: Item) => string;
  /** The focused item's id. The queue focuses the first item when this is null or the list was empty, and the neighbour of the item when it is gone from the same list. */
  focusedId: string | null;
  onFocusChange: (id: string | null) => void;
  /** One line in the list. */
  renderItem: (item: Item) => ReactNode;
  /** The focused item's fields. */
  renderDetail: (item: Item) => ReactNode;
  /** The focused item's actions; number keys 1 to 9 run them in order. */
  actions?: (item: Item) => ReadonlyArray<QueueAction>;
  /** A kind filter with counts, above the list. */
  kinds?: ReadonlyArray<FilterOption<string>>;
  kind?: string;
  onKindChange?: (kind: string) => void;
  /** One line per source that failed to load; the other sources still show. */
  errors?: ReadonlyArray<ReactNode>;
  loading?: boolean;
  /** What an empty queue shows. Default: an all-clear "Nothing waiting on you". */
  empty?: ReactNode;
  label: string;
  /** Rows get `<id>.row` with `data-row-id`; actions `<id>.action.<action id>`. */
  'data-testid'?: string;
}

const TONE: Record<NonNullable<QueueAction['tone']>, ButtonVariant> = { primary: 'primary', secondary: 'secondary', danger: 'danger' };

/**
 * A queue of items awaiting a decision: the list beside one focused item with its fields
 * and actions (stacked, focused item first, under 1024px). `j` and `k` move through the
 * list, number keys run the focused item's actions, and after an action the queue advances
 * to the next item by itself.
 */
export function QueueLayout<Item>({
  items,
  itemId,
  focusedId,
  onFocusChange,
  renderItem,
  renderDetail,
  actions,
  kinds,
  kind,
  onKindChange,
  errors = [],
  loading = false,
  empty,
  label,
  'data-testid': testId,
}: QueueLayoutProps<Item>) {
  const [running, setRunning] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = (suffix: string) => (testId ? `${testId}.${suffix}` : undefined);

  const ids = items.map(itemId);
  const index = focusedId == null ? -1 : ids.indexOf(focusedId);
  const focused = index >= 0 ? items[index] : undefined;
  const focusedActions = focused && actions ? actions(focused) : [];
  const lastIndex = useRef(0);
  if (index >= 0) lastIndex.current = index;
  else if (focusedId == null || ids.length === 0) lastIndex.current = 0;

  // Keep a focus while there are items: when the focused item goes, take its neighbour.
  useEffect(() => {
    const neighbour = ids[Math.min(lastIndex.current, ids.length - 1)];
    if (index < 0 && neighbour !== undefined) onFocusChange(neighbour);
    else if (ids.length === 0 && focusedId != null && !loading) onFocusChange(null);
  }, [index, ids.length, ids[0], focusedId, loading]);

  useEffect(() => {
    setFailure(null);
    if (focusedId == null) return;
    const row = [...(list.current?.children ?? [])].find((el) => (el as HTMLElement).dataset.rowId === focusedId);
    if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'nearest' });
  }, [focusedId]);

  const latest = useRef({ ids, index, focusedActions, running, focusedId });
  latest.current = { ids, index, focusedActions, running, focusedId };

  const run = async (action: QueueAction) => {
    const { ids: before, index: at, focusedId: was, running: busy } = latest.current;
    if (busy || action.disabled || at < 0) return;
    setRunning(action.id);
    setFailure(null);
    try {
      await action.run();
      // Advance to the item after this one in the list as it was, or the one before at the end.
      const next = before[at + 1] ?? before[at - 1] ?? null;
      if (latest.current.focusedId === was) onFocusChange(next);
    } catch (error) {
      setFailure(error instanceof Error && error.message ? error.message : 'The action failed');
    } finally {
      setRunning(null);
    }
  };
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
      const now = latest.current;
      if (event.key === 'j' || event.key === 'k') {
        if (!now.ids.length) return;
        event.preventDefault();
        const step = event.key === 'j' ? 1 : -1;
        const next = Math.min(Math.max(now.index + step, 0), now.ids.length - 1);
        const target = now.ids[now.index < 0 ? 0 : next];
        if (target !== undefined && target !== now.focusedId) onFocusChange(target);
      } else if (/^[1-9]$/.test(event.key)) {
        const action = now.focusedActions[Number(event.key) - 1];
        if (!action) return;
        event.preventDefault();
        void runRef.current(action);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onFocusChange]);

  return (
    <div className="ak-queue" data-testid={testId} aria-busy={loading || undefined}>
      {kinds && onKindChange && kind != null && <FilterSegment label="Kind" options={kinds} value={kind} onChange={onKindChange} data-testid={id('filter.kind')} />}
      {errors.filter(has).map((error, i) => (
        <Alert key={i} tone="danger" data-testid={id('error')}>
          {error}
        </Alert>
      ))}
      {items.length === 0 && !loading ? (
        <div className="ak-card" data-testid={id('empty')}>
          {empty ?? <EmptyState kind="all-clear" title="Nothing waiting on you" />}
        </div>
      ) : (
        <div className="ak-queue-panes">
          <ul ref={list} className="ak-card ak-queue-list" role="listbox" aria-label={label}>
            {items.map((item, i) => {
              const rid = ids[i] as string;
              return (
                <li
                  key={rid}
                  role="option"
                  aria-selected={rid === focusedId}
                  className={cx('ak-queue-item', rid === focusedId && 'ak-queue-item-focused')}
                  data-testid={id('row')}
                  data-row-id={rid}
                  onClick={() => onFocusChange(rid)}
                >
                  {renderItem(item)}
                </li>
              );
            })}
          </ul>
          <section className="ak-card ak-queue-detail" aria-label="Focused item" aria-live="polite">
            {focused ? (
              <>
                <div className="ak-queue-body">{renderDetail(focused)}</div>
                {failure && (
                  <Alert tone="danger" role="alert" className="ak-queue-failure">
                    {failure}
                  </Alert>
                )}
                {focusedActions.length > 0 && (
                  <div className="ak-queue-actions">
                    {focusedActions.map((action, n) => (
                      <Button
                        key={action.id}
                        variant={TONE[action.tone ?? 'secondary']}
                        disabled={action.disabled || running != null}
                        aria-keyshortcuts={n < 9 ? String(n + 1) : undefined}
                        data-testid={id(`action.${action.id}`)}
                        onClick={() => void run(action)}
                      >
                        {n < 9 && (
                          <kbd className="ak-kbd" aria-hidden="true">
                            {n + 1}
                          </kbd>
                        )}
                        {action.label}
                      </Button>
                    ))}
                    <span className="ak-queue-keys ak-muted" aria-hidden="true">
                      j/k move · 1–{Math.min(focusedActions.length, 9)} act
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="ak-queue-body ak-muted">{loading ? 'Loading…' : 'Pick an item'}</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
