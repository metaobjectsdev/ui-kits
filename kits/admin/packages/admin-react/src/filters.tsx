import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, SegmentedControl, inputClass, selectClass, type SegmentedOption } from './controls.js';
import { cx } from './cx.js';
import {
  PERIOD_PRESETS,
  currentMonth,
  decodePeriod,
  encodePeriod,
  formatMonth,
  formatRange,
  previousRange,
  resolvePeriod,
  stepMonth,
  type DayRange,
  type Period,
  type PeriodPreset,
} from './period.js';
import { useUrlParams, type UrlAdapter } from './url.js';

// ─── FilterBar ───────────────────────────────────────────

/**
 * The row of filters above a page's main table or blocks: period control, field filters,
 * search. It sticks to the top while the page scrolls. With `onClear` and at least one
 * active filter it offers "Clear filters".
 */
export function FilterBar({ children, label = 'Filters', activeCount = 0, onClear, className, 'data-testid': testId }: {
  children: ReactNode;
  label?: string;
  /** How many filters differ from the default view. */
  activeCount?: number;
  onClear?: () => void;
  className?: string;
  'data-testid'?: string;
}) {
  return (
    <div className={cx('ak-filterbar', className)} role="group" aria-label={label} data-testid={testId}>
      {children}
      {onClear && activeCount > 0 && (
        <Button variant="ghost" size="sm" className="ak-filterbar-clear" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

/** One labelled filter. The label is visible above the control on every width. */
export function FilterField({ label, htmlFor, children, className }: { label: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('ak-filter', className)}>
      {htmlFor ? (
        <label className="ak-filter-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="ak-filter-label">{label}</span>
      )}
      {children}
    </div>
  );
}

/**
 * A search box. It reports the text after a pause in typing (`delay`, default 250ms), or at
 * once on Enter, so a URL-bound search does not add a history entry per keystroke.
 */
export function FilterSearch({ label = 'Search', value, onChange, placeholder, delay = 250, 'data-testid': testId }: {
  label?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  delay?: number;
  'data-testid'?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  // Follow outside changes (back button, Clear filters).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setDraft(value);
  }, [value]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const commit = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (text !== value) latest.current(text);
  };
  return (
    <FilterField label={label} htmlFor={id} className="ak-filter-search">
      <input
        id={id}
        type="search"
        className={inputClass}
        value={draft}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(text), delay);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(draft);
        }}
      />
    </FilterField>
  );
}

export interface FilterOption<T extends string> {
  value: T;
  label: ReactNode;
  /** How many rows have this value, shown beside the label. */
  count?: number;
}

/** Up to six choices as a segmented control, each with an optional count. */
export function FilterSegment<T extends string>({ label, options, value, onChange, 'data-testid': testId }: {
  label: string;
  options: ReadonlyArray<FilterOption<T>>;
  value: T;
  onChange: (value: T) => void;
  'data-testid'?: string;
}) {
  const segments: Array<SegmentedOption<T>> = options.map((option) => ({
    value: option.value,
    label:
      option.count == null ? (
        option.label
      ) : (
        <>
          {option.label} <span className="ak-seg-count">{option.count}</span>
        </>
      ),
  }));
  return (
    <FilterField label={label}>
      <SegmentedControl label={label} options={segments} value={value} onChange={onChange} data-testid={testId} />
    </FilterField>
  );
}

/** Many choices as a select. `''` is the "all" option. */
export function FilterSelect<T extends string>({ label, options, value, onChange, allLabel = 'All', 'data-testid': testId }: {
  label: ReactNode;
  options: ReadonlyArray<FilterOption<T>>;
  value: T | '';
  onChange: (value: T | '') => void;
  allLabel?: string;
  'data-testid'?: string;
}) {
  const id = useId();
  return (
    <FilterField label={label} htmlFor={id}>
      <select id={id} className={selectClass} value={value} data-testid={testId} onChange={(event) => onChange(event.target.value as T | '')}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {typeof option.label === 'string' ? option.label : option.value}
            {option.count != null ? ` (${option.count})` : ''}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

// ─── PeriodControl ───────────────────────────────────────

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  month: 'Month',
  thisYear: 'This year',
  custom: 'Custom',
};

export interface PeriodControlProps {
  value: Period;
  onChange: (period: Period) => void;
  /** Which presets to offer, in order. Default: all of them. */
  presets?: readonly PeriodPreset[];
  /** Shows the "vs previous period" checkbox when set. */
  compare?: boolean;
  onCompareChange?: (compare: boolean) => void;
  /** Today, for tests and server rendering. Default: now. Days are UTC. */
  today?: Date;
  label?: string;
  'data-testid'?: string;
}

/**
 * Picks the period a page shows: presets, a month stepper, a custom range on native date
 * inputs, and an optional "vs previous period" toggle. The resolved days are shown, in UTC.
 */
export function PeriodControl({ value, onChange, presets = PERIOD_PRESETS, compare, onCompareChange, today, label = 'Period', 'data-testid': testId }: PeriodControlProps) {
  const now = today ?? new Date();
  const range = resolvePeriod(value, now);
  const compareId = useId();
  const fromId = useId();
  const toId = useId();
  const month = value.month ?? currentMonth(now);
  const latestMonth = currentMonth(now);

  const pick = (preset: PeriodPreset) => {
    if (preset === 'month') onChange({ preset, month: value.preset === 'month' ? month : currentMonth(now) });
    else if (preset === 'custom') onChange({ preset, from: range.from, to: range.to });
    else onChange({ preset });
  };

  return (
    <div className="ak-period" data-testid={testId}>
      <FilterField label={label}>
        <SegmentedControl label={label} options={presets.map((preset) => ({ value: preset, label: PERIOD_LABELS[preset] }))} value={value.preset} onChange={pick} />
      </FilterField>
      {value.preset === 'month' && (
        <div className="ak-period-stepper" role="group" aria-label="Month">
          <Button size="sm" icon aria-label="Previous month" onClick={() => onChange({ preset: 'month', month: stepMonth(month, -1) })}>
            ‹
          </Button>
          <span className="ak-period-month" aria-live="polite">
            {formatMonth(month)}
          </span>
          <Button size="sm" icon aria-label="Next month" disabled={month >= latestMonth} onClick={() => onChange({ preset: 'month', month: stepMonth(month, 1) })}>
            ›
          </Button>
        </div>
      )}
      {value.preset === 'custom' && (
        <div className="ak-period-custom">
          <FilterField label="From" htmlFor={fromId}>
            <input id={fromId} type="date" className={inputClass} value={range.from} max={range.to} onChange={(event) => event.target.value && onChange({ preset: 'custom', from: event.target.value, to: range.to })} />
          </FilterField>
          <FilterField label="To" htmlFor={toId}>
            <input id={toId} type="date" className={inputClass} value={range.to} min={range.from} onChange={(event) => event.target.value && onChange({ preset: 'custom', from: range.from, to: event.target.value })} />
          </FilterField>
        </div>
      )}
      {onCompareChange && (
        <label className="ak-check ak-period-compare" htmlFor={compareId}>
          <input id={compareId} type="checkbox" checked={!!compare} onChange={(event) => onCompareChange(event.target.checked)} />
          vs previous period
        </label>
      )}
      <span className="ak-period-range ak-num" data-testid={testId ? `${testId}.range` : undefined}>
        {formatRange(range)}
        {compare && <span className="ak-muted"> vs {formatRange(previousRange(value, range))}</span>}
      </span>
    </div>
  );
}

export interface PeriodParam {
  period: Period;
  setPeriod: (period: Period) => void;
  compare: boolean;
  setCompare: (compare: boolean) => void;
  /** The days the period covers. */
  range: DayRange;
  /** The comparison days when compare is on, otherwise null. */
  previous: DayRange | null;
}

/**
 * Binds a period and its compare toggle to the address (`?period=30d&compare=1`). The
 * default period is left out of the address, so the plain link is the default view.
 */
export function usePeriodParam({ name = 'period', compareName = 'compare', defaultPeriod = { preset: '30d' }, today, adapter }: {
  name?: string;
  compareName?: string;
  defaultPeriod?: Period;
  today?: Date;
  adapter?: UrlAdapter;
} = {}): PeriodParam {
  const [values, setValues] = useUrlParams([name, compareName], { defaults: { [name]: encodePeriod(defaultPeriod) }, adapter });
  const period = decodePeriod(values[name]) ?? defaultPeriod;
  const compare = values[compareName] === '1';
  const range = resolvePeriod(period, today ?? new Date());
  return {
    period,
    setPeriod: (next) => setValues({ [name]: encodePeriod(next) }),
    compare,
    setCompare: (on) => setValues({ [compareName]: on ? '1' : null }),
    range,
    previous: compare ? previousRange(period, range) : null,
  };
}
