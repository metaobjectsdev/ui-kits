import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, inputClass } from './controls.js';
import { cx } from './cx.js';
import { CloseIcon } from './icons.js';

export interface LookupOption {
  id: string;
  label: string;
  /** A second line, such as an email address or a status. */
  hint?: string;
}

export interface LookupPickerProps {
  value: LookupOption | null;
  onChange: (option: LookupOption | null) => void;
  /** Finds records for the typed text. Only the latest call's answer is shown; `signal` aborts older ones. */
  search: (query: string, signal: AbortSignal) => Promise<ReadonlyArray<LookupOption>>;
  /** The input's id, so a Field label binds to it. */
  id?: string;
  /** Accessible name when no Field label is bound. */
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  placeholder?: string;
  /** Characters to type before searching. Default 0: focusing lists the first matches. */
  minChars?: number;
  /** Pause after typing before a search, in ms. Default 200. */
  delay?: number;
  disabled?: boolean;
  noMatches?: ReactNode;
  'data-testid'?: string;
}

/**
 * Picks one record of a referenced kind by searching for it: a combobox over a listbox.
 * Arrow keys move, Enter picks, Esc closes; leaving the field without picking restores the
 * current choice, so it never holds free text. The clear button empties the choice.
 */
export function LookupPicker({
  value,
  onChange,
  search,
  id,
  'aria-label': ariaLabel,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  placeholder = 'Search…',
  minChars = 0,
  delay = 200,
  disabled = false,
  noMatches = 'No matches',
  'data-testid': testId,
}: LookupPickerProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const [text, setText] = useState(value?.label ?? '');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReadonlyArray<LookupOption>>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const searchRef = useRef(search);
  searchRef.current = search;

  // Follow a choice made from outside.
  useEffect(() => {
    if (document.activeElement !== input.current) setText(value?.label ?? '');
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
    },
    [],
  );

  const run = (query: string) => {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    if (query.trim().length < minChars) {
      setOptions([]);
      setStatus('idle');
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setStatus('loading');
    timer.current = setTimeout(() => {
      searchRef
        .current(query.trim(), controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setOptions(found);
          setActive(found.length ? 0 : -1);
          setStatus('done');
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setOptions([]);
          setStatus('error');
        });
    }, delay);
  };

  const openList = (query: string) => {
    setOpen(true);
    run(query);
  };

  const close = (restore: boolean) => {
    setOpen(false);
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    if (restore) setText(value?.label ?? '');
  };

  const pick = (option: LookupOption) => {
    setText(option.label);
    close(false);
    if (option.id !== value?.id) onChange(option);
  };

  const settled = status === 'done';
  const activeOption = open && settled && active >= 0 ? options[active] : undefined;

  return (
    <div className="ak-lookup" data-testid={testId}>
      <input
        ref={input}
        id={inputId}
        className={inputClass}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onFocus={() => {
          if (!open) openList(text === value?.label ? '' : text);
        }}
        onChange={(event) => {
          setText(event.target.value);
          openList(event.target.value);
        }}
        onBlur={() => close(true)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              openList('');
              return;
            }
            if (!settled || !options.length) return;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive((at) => (at + step + options.length) % options.length);
          } else if (event.key === 'Enter') {
            if (open && activeOption) {
              event.preventDefault();
              pick(activeOption);
            }
          } else if (event.key === 'Escape') {
            if (open) {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            }
          }
        }}
      />
      {value && !disabled && (
        <Button
          variant="ghost"
          size="sm"
          icon
          className="ak-lookup-clear"
          aria-label={`Clear ${value.label}`}
          onClick={() => {
            setText('');
            onChange(null);
            input.current?.focus();
          }}
        >
          <CloseIcon />
        </Button>
      )}
      {open && (
        <ul className="ak-lookup-list" id={listId} role="listbox" aria-label={ariaLabel ?? 'Matches'}>
          {status === 'loading' && (
            <li className="ak-lookup-note" role="presentation" aria-live="polite">
              Searching…
            </li>
          )}
          {status === 'error' && (
            <li className="ak-lookup-note ak-lookup-error" role="presentation">
              Search failed. Type to try again.
            </li>
          )}
          {status === 'done' && options.length === 0 && (
            <li className="ak-lookup-note" role="presentation">
              {noMatches}
            </li>
          )}
          {status === 'idle' && minChars > 0 && (
            <li className="ak-lookup-note" role="presentation">
              Type {minChars} or more characters
            </li>
          )}
          {status === 'done' &&
            options.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-${option.id}`}
                role="option"
                aria-selected={option.id === value?.id}
                className={cx('ak-lookup-option', index === active && 'ak-lookup-active')}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(option)}
              >
                <span>{option.label}</span>
                {option.hint && <span className="ak-lookup-hint">{option.hint}</span>}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
