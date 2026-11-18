// The data rules every chart shares, as plain functions a code generator can call too:
// a missing point is a gap (never zero), one unit per chart, at most six series.
import { csvCell } from './csv.js';

/** One reading. `null`, `undefined` or a non-finite number is a gap: no reading, never zero. */
export type ChartValue = number | null | undefined;

/** One x position (a category or a time bucket) and its reading for each series key. */
export interface ChartRow {
  /** Stable identity, also the table row's `data-row-id`. */
  key: string;
  /** What the x axis, the hover text and the table show. */
  label: string;
  values: Readonly<Record<string, ChartValue>>;
}

export interface ChartSeries {
  /** Key into each row's `values`, and the table cell's test-id suffix. */
  key: string;
  label: string;
  /** The series' unit. When given it must equal the chart's `unit`, or the chart refuses to draw. */
  unit?: string;
  /** LineChart only: the key of the series this one is a comparison for (last month against this
   *  month). It is drawn dashed in that series' colour and takes no palette slot. */
  compare?: string;
}

/** At most this many series are drawn; more fold into the top five and "Other". */
export const MAX_SERIES = 6;
/** The key and label of the folded series. The key is one a data field name is unlikely to take. */
export const OTHER_KEY = '_other';
export const OTHER_LABEL = 'Other';

export function isGap(value: ChartValue): value is null | undefined {
  return value == null || !Number.isFinite(value);
}

/** The outcome of the one-unit rule. A generator refuses to emit a chart when `ok` is false. */
export type ChartUnitCheck = { ok: true; unit: string } | { ok: false; code: 'mixed-units'; units: string[] };

/**
 * One unit per chart: every series that names a unit must name the chart's. Units are compared
 * as exact strings, so "USD billed" and "USD notional" are two units and never share a chart.
 */
export function checkChartUnits(unit: string, series: readonly ChartSeries[]): ChartUnitCheck {
  const units = [...new Set([unit, ...series.map((s) => s.unit).filter((u): u is string => u != null)])];
  return units.length === 1 ? { ok: true, unit } : { ok: false, code: 'mixed-units', units };
}

/**
 * At most six series. With more, the five largest (by the sum of their absolute values) stay,
 * in their given order, and the rest sum into one "Other" series. Comparison series count
 * against the six but never fold; they stay beside the series they compare. A row where every
 * folded series is a gap has a gap for "Other", not a zero.
 */
export function foldSeries(rows: readonly ChartRow[], series: readonly ChartSeries[], max = MAX_SERIES): {
  rows: ChartRow[];
  series: ChartSeries[];
} {
  if (series.length <= max) return { rows: [...rows], series: [...series] };
  const main = series.filter((s) => s.compare == null);
  const room = Math.max(1, max - (series.length - main.length) - 1);
  const size = (key: string) => rows.reduce((sum, row) => sum + (isGap(row.values[key]) ? 0 : Math.abs(row.values[key] as number)), 0);
  const ranked = main
    .map((s, index) => ({ s, index, size: size(s.key) }))
    .sort((a, b) => b.size - a.size || a.index - b.index);
  const kept = new Set(ranked.slice(0, room).map((r) => r.s.key));
  const folded = main.filter((s) => !kept.has(s.key)).map((s) => s.key);
  const keptSeries = series.filter((s) => (s.compare == null ? kept.has(s.key) : kept.has(s.compare)));
  const unit = series.find((s) => s.unit != null)?.unit;
  const other: ChartSeries = { key: OTHER_KEY, label: OTHER_LABEL, ...(unit != null && { unit }) };
  return {
    series: [...keptSeries, other],
    rows: rows.map((row) => {
      const known = folded.map((key) => row.values[key]).filter((v): v is number => !isGap(v));
      return { ...row, values: { ...row.values, [OTHER_KEY]: known.length ? known.reduce((a, b) => a + b, 0) : null } };
    }),
  };
}

/** A round axis bound: the next 1, 2, 2.5 or 5 times a power of ten away from zero. */
export function niceBound(value: number): number {
  if (value === 0) return 0;
  const sign = Math.sign(value);
  const abs = Math.abs(value);
  const power = 10 ** Math.floor(Math.log10(abs));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= abs - power * 1e-9) ?? 10;
  return sign * step * power;
}

/** The value range an axis shows: always includes zero, rounded outwards, never empty. */
export function chartDomain(values: readonly number[]): { min: number; max: number } {
  const min = niceBound(Math.min(0, ...values));
  const max = niceBound(Math.max(0, ...values));
  return min === max ? { min: 0, max: 1 } : { min, max };
}

/**
 * The chart's rows as CSV, the same table "Show as table" renders: a header row, then one line
 * per row, and a Total column when `total` is set (empty when any series has a gap). A gap is an
 * empty cell, never 0. Numbers are written raw, without the display format; a label a
 * spreadsheet would run as a formula is defused.
 */
export function chartCsv(rows: readonly ChartRow[], series: readonly ChartSeries[], xLabel = 'Label', total = false): string {
  const lines: unknown[][] = [[xLabel, ...series.map((s) => s.label), ...(total ? ['Total'] : [])]];
  for (const row of rows) {
    const values = series.map((s) => (isGap(row.values[s.key]) ? null : row.values[s.key]));
    const sum = values.some((v) => v == null) ? null : (values as number[]).reduce((a, b) => a + b, 0);
    lines.push([row.label, ...values, ...(total ? [sum] : [])]);
  }
  return `${lines.map((line) => line.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
