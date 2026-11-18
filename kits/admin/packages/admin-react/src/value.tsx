import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from './controls.js';
import { cx } from './cx.js';
import {
  EXTERNAL_REL,
  UNKNOWN_TEXT,
  formatExactUtc,
  formatMoney,
  formatNumber,
  formatRelative,
  formatUtcDay,
  isUnknown,
  safeHref,
  toDate,
  type MoneyFormat,
  type MoneyKind,
} from './format.js';
import { Badge, type BadgeTone } from './status.js';

/**
 * How a field renders. Each kind applies one kit rule:
 * - `text` (the default), `number`, `boolean`, `code`: plain text.
 * - `money`: sign and cents, marked billed or notional.
 * - `date`: the UTC day, never shifted by the browser's zone.
 * - `timestamp`: relative ("3 h ago") with the exact UTC time on hover.
 * - `badge`: an enum value as a badge, with a tone per value.
 * - `reference`: a link to the referenced record (`href`).
 * - `url`: an external link, only for http and https; anything else stays text.
 * - `multiline`: plain text with its line breaks kept.
 */
export type ValueView =
  | { kind?: 'text' }
  | { kind: 'number'; maximumFractionDigits?: number; locale?: string }
  | { kind: 'boolean'; yes?: string; no?: string }
  | { kind: 'code' }
  | ({ kind: 'money'; moneyKind: MoneyKind } & MoneyFormat)
  | { kind: 'date' }
  | { kind: 'timestamp'; now?: Date | number }
  | { kind: 'badge'; tones?: Readonly<Record<string, BadgeTone>>; labels?: Readonly<Record<string, ReactNode>> }
  | { kind: 'reference' }
  | { kind: 'url'; label?: ReactNode }
  | { kind: 'multiline' };

export type ValueProps = ValueView & {
  value: unknown;
  /** The referenced record's address, for `kind: 'reference'`. */
  href?: string;
  className?: string;
  'data-testid'?: string;
};

/** The unknown marker: "—", announced as "unknown". */
export function Unknown({ className, 'data-testid': testId }: { className?: string; 'data-testid'?: string }) {
  return (
    <span className={cx('ak-unknown', className)} title="Unknown" data-testid={testId} data-unknown="">
      <span aria-hidden="true">{UNKNOWN_TEXT}</span>
      <span className="ak-sr-only">unknown</span>
    </span>
  );
}

// One shared clock for every relative timestamp on the page, ticking every 30 seconds
// while at least one is mounted.
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let clockNow = Date.now();
function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (clockTimer == null) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const l of clockListeners) l();
    }, 30_000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer != null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}
function useClock(fixed: Date | number | undefined): number {
  // The store only schedules re-renders; each render reads the time afresh.
  const tick = useSyncExternalStore(subscribeClock, () => clockNow, () => clockNow);
  if (fixed != null) return typeof fixed === 'number' ? fixed : fixed.getTime();
  return Math.max(tick, Date.now());
}

function Timestamp({ value, now, className, testId }: { value: Date | string | number; now?: Date | number; className?: string; testId?: string }) {
  const clock = useClock(now);
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return <Unknown className={className} data-testid={testId} />;
  const exact = formatExactUtc(date);
  return (
    <time className={cx('ak-value', className)} dateTime={date.toISOString()} title={exact} aria-label={`${formatRelative(date, clock)} (${exact})`} data-testid={testId}>
      {formatRelative(date, clock)}
    </time>
  );
}

/** One field value, rendered by the kit's value rules. See ValueView. */
export function Value(props: ValueProps) {
  const { value, className, 'data-testid': testId } = props;
  if (isUnknown(value)) return <Unknown className={className} data-testid={testId} />;
  const text = (content: ReactNode, extra?: string) => (
    <span className={cx('ak-value', extra, className)} data-testid={testId}>
      {content}
    </span>
  );

  switch (props.kind) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(n)) return <Unknown className={className} data-testid={testId} />;
      return text(formatNumber(n, props), 'ak-num');
    }
    case 'boolean':
      return text(value ? (props.yes ?? 'Yes') : (props.no ?? 'No'));
    case 'code':
      return text(String(value), 'ak-code');
    case 'money': {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(n)) return <Unknown className={className} data-testid={testId} />;
      const notional = props.moneyKind === 'notional';
      return (
        <span
          className={cx('ak-value ak-num ak-money', notional && 'ak-money-notional', n < 0 && 'ak-money-negative', className)}
          data-money-kind={props.moneyKind}
          title={notional ? 'Notional: not billed' : undefined}
          data-testid={testId}
        >
          {formatMoney(n, props)}
          {notional && <span className="ak-sr-only"> (notional)</span>}
        </span>
      );
    }
    case 'date': {
      const date = toDate(value as Date | string | number);
      if (Number.isNaN(date.getTime())) return <Unknown className={className} data-testid={testId} />;
      const day = formatUtcDay(date);
      return (
        <time className={cx('ak-value ak-num', className)} dateTime={day} data-testid={testId}>
          {day}
        </time>
      );
    }
    case 'timestamp':
      return <Timestamp value={value as Date | string | number} now={props.now} className={className} testId={testId} />;
    case 'badge': {
      const key = String(value);
      return (
        <Badge tone={props.tones?.[key] ?? 'neutral'} className={className} data-testid={testId}>
          {props.labels?.[key] ?? key}
        </Badge>
      );
    }
    case 'reference':
      if (!props.href) return text(String(value));
      return (
        <a className={cx('ak-value ak-link', className)} href={props.href} data-testid={testId}>
          {String(value)}
        </a>
      );
    case 'url': {
      const href = safeHref(value);
      if (!href) return text(String(value), 'ak-wrap-text');
      return (
        <a className={cx('ak-value ak-link', className)} href={href} target="_blank" rel={EXTERNAL_REL} data-testid={testId}>
          {props.label ?? String(value)}
        </a>
      );
    }
    case 'multiline':
      return text(String(value), 'ak-multiline');
    default:
      return text(value instanceof Date ? formatExactUtc(value) : String(value));
  }
}

// ─── CopyValue ───────────────────────────────────────────

/**
 * A code-like value (an id, a key name, a hash) with a button that copies it. The result
 * is announced: "Copied" or "Copy failed". An unknown value shows "—" and no button.
 */
export function CopyValue({ value, label = 'Copy', className, 'data-testid': testId }: {
  value: string | number | null | undefined;
  /** Accessible name of the copy button; the value is appended. */
  label?: string;
  className?: string;
  'data-testid'?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  if (isUnknown(value)) return <Unknown className={className} data-testid={testId} />;
  const text = String(value);

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <span className={cx('ak-copy', className)} data-testid={testId}>
      <code className="ak-code">{text}</code>
      <Button variant="ghost" size="sm" className="ak-copy-btn" aria-label={`${label} ${text}`} onClick={copy}>
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Failed' : 'Copy'}
      </Button>
      <span className="ak-sr-only" role="status">
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : ''}
      </span>
    </span>
  );
}

// ─── DefinitionList ──────────────────────────────────────

export interface DefinitionItem {
  /** Stable key; also the field part of the item's test id. */
  key: string;
  label: ReactNode;
  /** The rendered value. null, undefined and '' render as "—". */
  value: ReactNode;
  /** A long value (a message body, a runbook) that spans the full width. */
  wide?: boolean;
}

export interface DefinitionGroup {
  title?: ReactNode;
  items: ReadonlyArray<DefinitionItem>;
}

/**
 * Label and value pairs, in optional titled groups. Two columns of pairs from 640px up,
 * one below. Each value's test id is `<data-testid>.<key>`.
 */
export function DefinitionList({ items, groups, className, 'data-testid': testId }: {
  items?: ReadonlyArray<DefinitionItem>;
  groups?: ReadonlyArray<DefinitionGroup>;
  className?: string;
  'data-testid'?: string;
}) {
  const all: ReadonlyArray<DefinitionGroup> = groups ?? [{ items: items ?? [] }];
  return (
    <div className={cx('ak-dl-wrap', className)} data-testid={testId}>
      {all.map((group, g) => (
        <div className="ak-dl-group" key={g}>
          {group.title != null && <h3 className="ak-dl-title">{group.title}</h3>}
          <dl className="ak-dl">
            {group.items.map((item) => (
              <div key={item.key} className={cx('ak-dl-row', item.wide && 'ak-dl-wide')}>
                <dt>{item.label}</dt>
                <dd data-testid={testId ? `${testId}.${item.key}` : undefined}>
                  {isUnknown(item.value) || item.value === false ? <Unknown /> : item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
