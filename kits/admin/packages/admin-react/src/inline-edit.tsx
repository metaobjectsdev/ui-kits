import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { inputClass, selectClass } from './controls.js';
import { cx } from './cx.js';
import { isUnknown } from './format.js';
import { Unknown } from './value.js';

/** The state of the data the cell shows: still loading, failed to load, or loaded. */
export type LoadState = 'pending' | 'error' | 'ready';

export interface InlineEditCellProps {
  /** The saved value, as the input holds it (`YYYY-MM-DD` for a date). null or '' is unknown. */
  value: string | null | undefined;
  /** Accessible name of the cell's control, such as "Follow-up date for A. Example". */
  label: string;
  /**
   * The state of the load behind the value. The cell edits and saves only when it is
   * `ready`: it never saves over data that is still loading or failed to load.
   */
  load: LoadState;
  /** Saves a changed value. Reject (or throw) to keep the edit open with an error. */
  onSave: (next: string) => Promise<void> | void;
  type?: 'text' | 'number' | 'date' | 'select';
  /** The choices, for `type: 'select'`. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** How the value shows when not editing. Default: the value, or "—". */
  display?: ReactNode;
  'data-testid'?: string;
}

type Mode = 'view' | 'editing' | 'saving' | 'error';

/**
 * A table cell that edits in place: click (or Enter) to edit, and the value saves when
 * the field loses focus or on Enter; Esc cancels. Only a changed value saves, one save at a
 * time, and never while the load behind it is pending or failed. A failed save keeps the
 * edit and shows the error, so nothing typed is lost.
 */
export function InlineEditCell({ value, label, load, onSave, type = 'text', options = [], display, 'data-testid': testId }: InlineEditCellProps) {
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(value ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const field = useRef<HTMLInputElement & HTMLSelectElement>(null);
  const viewButton = useRef<HTMLButtonElement>(null);
  const latest = useRef({ load, value, mode });
  latest.current = { load, value, mode };
  const ready = load === 'ready';

  // A load that stops being ready ends the edit without saving.
  useEffect(() => {
    if (!ready && (mode === 'editing' || mode === 'error')) {
      setMode('view');
      setMessage(null);
    }
  }, [ready, mode]);

  const refocusOnError = useRef(false);
  useEffect(() => {
    if (mode === 'editing' || (mode === 'error' && refocusOnError.current)) field.current?.focus();
  }, [mode]);

  const start = () => {
    if (!ready) return;
    setDraft(value ?? '');
    setMessage(null);
    setMode('editing');
  };

  const cancel = () => {
    setMode('view');
    setMessage(null);
    requestAnimationFrame(() => viewButton.current?.focus());
  };

  const save = async (refocus: boolean) => {
    const now = latest.current;
    if (now.mode !== 'editing' && now.mode !== 'error') return;
    // The guard: never save over a pending or failed load.
    if (now.load !== 'ready') {
      setMode('view');
      return;
    }
    if (draft === (now.value ?? '')) {
      setMode('view');
      if (refocus) requestAnimationFrame(() => viewButton.current?.focus());
      return;
    }
    refocusOnError.current = refocus;
    setMode('saving');
    latest.current.mode = 'saving';
    try {
      await onSave(draft);
      setMode('view');
      setMessage(null);
      if (refocus) requestAnimationFrame(() => viewButton.current?.focus());
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : 'Could not save');
      setMode('error');
    }
  };

  const state = !ready ? 'locked' : mode === 'view' ? 'idle' : mode;

  if (mode === 'view' || !ready) {
    const shown = display ?? (isUnknown(value) ? <Unknown /> : value);
    return (
      <span className="ak-iedit" data-testid={testId} data-state={state}>
        <button
          ref={viewButton}
          type="button"
          className="ak-iedit-view"
          aria-label={`${label}: ${isUnknown(value) ? 'unknown' : value}. ${ready ? 'Edit' : load === 'pending' ? 'Loading, cannot edit yet' : 'Failed to load, cannot edit'}`}
          disabled={!ready}
          title={ready ? 'Edit' : load === 'pending' ? 'Still loading' : 'Failed to load'}
          onClick={start}
        >
          {shown}
        </button>
      </span>
    );
  }

  const common = {
    ref: field,
    'aria-label': label,
    'aria-invalid': mode === 'error' ? (true as const) : undefined,
    disabled: mode === 'saving',
    onBlur: () => void save(false),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancel();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void save(true);
      }
    },
  };

  return (
    <span className="ak-iedit" data-testid={testId} data-state={state} aria-busy={mode === 'saving' || undefined}>
      {type === 'select' ? (
        <select {...common} className={cx(selectClass, 'ak-iedit-field')} value={draft} onChange={(event) => setDraft(event.target.value)}>
          {!options.some((option) => option.value === draft) && <option value={draft}>{draft || '—'}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          className={cx(inputClass, 'ak-iedit-field')}
          type={type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      {mode === 'saving' && <span className="ak-sr-only" role="status">Saving</span>}
      {mode === 'error' && message && (
        <span className="ak-iedit-error" role="alert">
          {message}
        </span>
      )}
    </span>
  );
}
