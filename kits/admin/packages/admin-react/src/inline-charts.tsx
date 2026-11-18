import { isGap, type ChartValue } from './chart-data.js';
import { cx } from './cx.js';
import { Badge } from './status.js';

// Sparkline and Meter: small enough for a table cell or a stat tile. Same rules as the charts:
// inline SVG with geometry in attributes, colour from the series palette, no url(), no inline
// styles, and an unknown value is "—", never 0.

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

/** The unknown-value mark for a cell or tile, named for a screen reader. */
function UnknownValue({ label, testId }: { label: string; testId: string | undefined }) {
  return (
    <span className="ak-unknown" data-testid={testId} data-state="unknown">
      <span aria-hidden="true">—</span>
      <span className="ak-sr-only">{label}: no data</span>
    </span>
  );
}

// ─── Sparkline ───────────────────────────────────────────

const SPARK_W = 100;
const SPARK_H = 24;
const SPARK_PAD = 2;

export interface SparklineProps {
  /** One reading per slot, oldest first. A gap (`null`) breaks the line or leaves the bar slot empty. */
  values: readonly ChartValue[];
  /** The accessible name, such as "Orders, last 14 days". */
  label: string;
  /** A trend line (the default) or a bar per slot. */
  kind?: 'line' | 'bar';
  /** Per-slot labels for the hover text, such as dates. */
  labels?: readonly string[];
  /** Formats a value for hover text and the accessible name. */
  format?: (value: number) => string;
  /** The cell or tile test id (`<page>.<block>.<field>`). */
  'data-testid'?: string;
}

/**
 * A word-sized trend for a table cell or a stat tile. Scaled to its own range (always including
 * zero). A series with no reading at all renders "—", not a flat line at zero. A measured zero in
 * the bar form keeps a 1-unit stub, so "zero" and "no reading" never look the same.
 */
export function Sparkline({ values, label, kind = 'line', labels, format = (v) => numberFormat.format(v), 'data-testid': testId }: SparklineProps) {
  const known = values.filter((v): v is number => !isGap(v));
  if (known.length === 0) return <UnknownValue label={label} testId={testId} />;
  const low = Math.min(0, ...known);
  const high = Math.max(0, ...known);
  const span = high - low || 1;
  const usable = SPARK_H - SPARK_PAD * 2;
  const y = (v: number) => SPARK_PAD + usable - ((v - low) / span) * usable;
  const step = SPARK_W / values.length;
  const mid = (i: number) => i * step + step / 2;
  const newest = values[values.length - 1] as ChartValue;
  const name = `${label}: latest ${isGap(newest) ? 'no data' : format(newest)}, low ${format(Math.min(...known))}, high ${format(Math.max(...known))}`;

  let marks;
  if (kind === 'bar') {
    const bar = Math.max(1, step * 0.7);
    marks = values.map((v, i) => {
      if (isGap(v)) return null;
      const height = Math.max(1, Math.abs(y(v) - y(0)));
      return <rect key={i} className="ak-spark-bar" x={mid(i) - bar / 2} width={bar} y={v >= 0 ? y(0) - height : y(0)} height={height} />;
    });
  } else {
    let d = '';
    let run: string[] = [];
    const flush = () => {
      if (run.length) d += run.length === 1 ? `M${run[0]}h0` : `M${run.join('L')}`;
      run = [];
    };
    values.forEach((v, i) => (isGap(v) ? flush() : run.push(`${mid(i)} ${y(v)}`)));
    flush();
    marks = <path className="ak-spark-line" d={d} />;
  }

  return (
    <svg
      className={cx('ak-sparkline', kind === 'bar' && 'ak-sparkline-bar')}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={name}
      data-testid={testId}
    >
      {marks}
      {values.map((v, i) => (
        <rect key={`hit${i}`} className="ak-chart-hit" x={i * step} y="0" width={step} height={SPARK_H}>
          <title>{`${labels?.[i] ?? `Point ${i + 1}`}: ${isGap(v) ? 'no data' : format(v)}`}</title>
        </rect>
      ))}
    </svg>
  );
}

// ─── Meter ───────────────────────────────────────────────

export type MeterTone = 'default' | 'warning' | 'danger';

export interface MeterProps {
  /** The amount used. Unknown (`null`) renders "—". */
  value: ChartValue;
  /** The limit. Unknown or not above zero renders "—". */
  max: ChartValue;
  /** The accessible name, such as "Monthly budget". */
  label: string;
  /** Formats the value and the limit, such as a currency formatter. */
  format?: (value: number) => string;
  /** The colour. By default: danger at or past the limit, warning from `warnAt`, default below. */
  tone?: MeterTone;
  /** The share of the limit (0 to 1) from which the meter turns to warning. */
  warnAt?: number;
  /** The reading may be out of date: the fill fades and a "stale" badge shows. */
  stale?: boolean;
  /** One line for a table cell: the bar and the percentage, without the "of" text. */
  inline?: boolean;
  /** The tile or cell test id. */
  'data-testid'?: string;
}

/**
 * One value against a limit, for a stat tile or a table cell. Past the limit the bar stays full,
 * the percentage says how far past, and the tone turns to danger.
 */
export function Meter({ value, max, label, format = (v) => numberFormat.format(v), tone, warnAt, stale = false, inline = false, 'data-testid': testId }: MeterProps) {
  if (isGap(value) || isGap(max) || max <= 0) return <UnknownValue label={label} testId={testId} />;
  const share = value / max;
  const shown = tone ?? (share >= 1 ? 'danger' : warnAt != null && share >= warnAt ? 'warning' : 'default');
  const pct = percentFormat.format(share);
  const text = `${format(value)} of ${format(max)}`;
  const fill = Math.max(0, Math.min(1, share)) * 100;
  return (
    <div
      className={cx('ak-meter', inline && 'ak-meter-inline', shown !== 'default' && `ak-meter-${shown}`, stale && 'ak-meter-stale')}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.max(0, Math.min(max, value))}
      aria-valuetext={`${text} (${pct})${stale ? ', stale' : ''}`}
      data-testid={testId}
      data-tone={shown}
    >
      {!inline && (
        <div className="ak-meter-text" aria-hidden="true">
          <span className="ak-meter-pct">{pct}</span>
          <span className="ak-meter-of">{text}</span>
          {stale && <Badge tone="warning">stale</Badge>}
        </div>
      )}
      <span className="ak-meter-track" aria-hidden="true">
        <svg className="ak-meter-svg" viewBox="0 0 100 8" preserveAspectRatio="none" focusable="false">
          {fill > 0 && <rect className="ak-meter-fill" x="0" y="0" width={fill} height="8" />}
        </svg>
      </span>
      {inline && (
        <span className="ak-meter-pct" aria-hidden="true">
          {pct}
        </span>
      )}
    </div>
  );
}
