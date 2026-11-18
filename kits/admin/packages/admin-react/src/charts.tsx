import { Fragment, useState, type ReactNode } from 'react';
import {
  OTHER_KEY,
  chartCsv,
  checkChartUnits,
  chartDomain,
  foldSeries,
  isGap,
  type ChartRow,
  type ChartSeries,
  type ChartValue,
} from './chart-data.js';
import { Button } from './controls.js';
import { downloadCsv } from './csv.js';
import { cx } from './cx.js';
import { Alert, EmptyState } from './status.js';

// Charts: inline SVG, no library, no url() (so no SVG patterns or markers), and no inline styles,
// so they render under a `default-src 'none'; style-src 'self'` policy even when server-rendered.
// Geometry goes in SVG attributes; colour, type and layout come from components.css. The SVG
// stretches to its box, so it holds no text: labels, ticks and the legend are HTML around it.

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/** The default value format: the number with up to two decimals, then the unit. */
export function formatChartValue(value: number, unit: string): string {
  return unit ? `${numberFormat.format(value)} ${unit}` : numberFormat.format(value);
}

/** The unknown-value mark, with words for a screen reader. */
function Unknown() {
  return (
    <>
      <span aria-hidden="true">—</span>
      <span className="ak-sr-only">no data</span>
    </>
  );
}

/** Test id `<base>.<suffix>`, or none when the chart has no base id. */
const childId = (base: string | undefined, suffix: string) => (base ? `${base}.${suffix}` : undefined);

// ─── Series colours ──────────────────────────────────────

/** Six slots from the series palette (the same in light and dark), plus grey for "Other". */
const SERIES_CLASSES = ['ak-chart-s1', 'ak-chart-s2', 'ak-chart-s3', 'ak-chart-s4', 'ak-chart-s5', 'ak-chart-s6'] as const;
const OTHER_CLASS = 'ak-chart-s-other';

/** Slot class per series key: given order, "Other" grey, a comparison takes its target's slot. */
function seriesClasses(series: readonly ChartSeries[]): Map<string, string> {
  const classes = new Map<string, string>();
  let slot = 0;
  for (const s of series) {
    if (s.compare != null && series.some((t) => t.key === s.compare && t.compare == null)) continue;
    classes.set(s.key, s.key === OTHER_KEY ? OTHER_CLASS : (SERIES_CLASSES[slot++ % SERIES_CLASSES.length] as string));
  }
  for (const s of series) if (!classes.has(s.key)) classes.set(s.key, classes.get(s.compare as string) ?? OTHER_CLASS);
  return classes;
}

// ─── The table form ──────────────────────────────────────

export interface ChartTableProps {
  /** The table caption; a chart passes its own title. */
  title: string;
  rows: readonly ChartRow[];
  series: readonly ChartSeries[];
  unit: string;
  format?: (value: number) => string;
  /** Header of the label column. */
  xLabel?: string;
  /** Adds a Total column: the row's sum, or the unknown mark when any series has a gap. */
  total?: boolean;
  className?: string;
  /** Rows get `<id>.row` with `data-row-id`, cells `<id>.<series key>`. */
  'data-testid'?: string;
}

/**
 * A chart's rows as a table: one row per x position, one column per series. It is what "Show as
 * table" shows, a chart's accessible form, and the same rows `chartCsv` writes. A gap is the
 * unknown mark, never 0.
 */
export function ChartTable({ title, rows, series, unit, format, xLabel = 'Label', total = false, className, 'data-testid': testId }: ChartTableProps) {
  const show = format ?? ((value: number) => formatChartValue(value, unit));
  const cell = (value: ChartValue) => (isGap(value) ? <Unknown /> : show(value));
  return (
    <div className={cx('ak-table-wrap', 'ak-chart-table', className)}>
      <table className="ak-table">
        <caption className="ak-sr-only">{unit ? `${title} (${unit})` : title}</caption>
        <thead>
          <tr>
            <th scope="col">{xLabel}</th>
            {series.map((s) => (
              <th key={s.key} scope="col" className="ak-right">
                {s.label}
              </th>
            ))}
            {total && (
              <th scope="col" className="ak-right">
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const values = series.map((s) => row.values[s.key]);
            return (
              <tr key={row.key} data-testid={childId(testId, 'row')} data-row-id={row.key}>
                <th scope="row">{row.label}</th>
                {series.map((s, i) => (
                  <td key={s.key} className="ak-right ak-num" data-testid={childId(testId, s.key)}>
                    {cell(values[i])}
                  </td>
                ))}
                {total && (
                  <td className="ak-right ak-num" data-testid={childId(testId, 'total')}>
                    {cell(values.some(isGap) ? null : (values as number[]).reduce((a, b) => a + b, 0))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── The shared frame ────────────────────────────────────

export interface ChartProps {
  /** The chart's accessible name and its table caption. The visible heading is the card's. */
  title: string;
  /** One row per x position, in x order. */
  rows: readonly ChartRow[];
  /** At most six are drawn; more fold into the five largest plus "Other". */
  series: readonly ChartSeries[];
  /** The chart's one unit. A series naming another unit makes the chart refuse to draw. */
  unit: string;
  /** Formats a value for hover text and the table. Defaults to the number and the unit. */
  format?: (value: number) => string;
  /** Formats the y-axis labels. Defaults to a compact number ("1.2K"). */
  formatAxis?: (value: number) => string;
  /** Header of the table's label column. */
  xLabel?: string;
  /** What shows when there are no rows. */
  empty?: ReactNode;
  /** Start in the table view. */
  defaultView?: 'chart' | 'table';
  /** File name of the table view's "Export CSV" download. Defaults to the title. */
  csvFilename?: string;
  /**
   * The block's test id (`<page>.<block>`). Derived: `.action.table` (the toggle),
   * `.action.export` (the CSV download, in the table view), `.row` with `data-row-id`,
   * `.<series key>` (table cells), `.empty`, `.error`.
   */
  'data-testid'?: string;
}

interface PlotContext {
  rows: ChartRow[];
  series: ChartSeries[];
  classes: Map<string, string>;
  /** y coordinate (0 at the top, 100 at the bottom) of a value. */
  y: (value: number) => number;
  /** The band of x position i: its left edge and width, in a 0 to 100 space. */
  band: (i: number) => { x: number; width: number };
  /** Hover text for row i. */
  hover: (i: number) => string;
}

/** Keeps coordinates short in the markup; a thousandth of the plot is far below a pixel. */
const round = (n: number) => Math.round(n * 1000) / 1000;

/** The vertical extent the plot draws in. Text never sits inside the SVG. */
const PLOT_H = 100;

/**
 * Which x labels show: at most eight, and at most four "major" ones that stay on a narrow
 * (phone) chart; the minor ones hide there through a container query.
 */
export function xTicks(count: number): Array<'major' | 'minor' | null> {
  const step = Math.max(1, Math.ceil(count / 8));
  const shown = Math.ceil(count / step);
  return Array.from({ length: count }, (_, i) => {
    if (i % step !== 0) return null;
    return shown <= 4 || (i / step) % 2 === 0 ? 'major' : 'minor';
  });
}

function ChartFrame({
  props,
  kind,
  domainValues,
  plot,
  lineKeys = false,
  total = false,
}: {
  props: ChartProps;
  kind: 'bar' | 'line';
  domainValues: (rows: ChartRow[], series: ChartSeries[]) => number[];
  plot: (ctx: PlotContext) => ReactNode;
  lineKeys?: boolean;
  total?: boolean;
}) {
  const { title, unit, format, formatAxis, xLabel, empty, defaultView = 'chart', csvFilename, 'data-testid': testId } = props;
  const [view, setView] = useState(defaultView);
  const units = checkChartUnits(unit, props.series);
  if (!units.ok) {
    return (
      <Alert tone="danger" role="alert">
        <span data-testid={childId(testId, 'error')} data-error={units.code}>
          {title}: one chart cannot mix units ({units.units.join(', ')}).
        </span>
      </Alert>
    );
  }
  if (props.rows.length === 0) {
    return (
      <div data-testid={childId(testId, 'empty')}>
        <EmptyState>{empty ?? 'No data for this chart.'}</EmptyState>
      </div>
    );
  }

  const { rows, series } = foldSeries(props.rows, props.series);
  const classes = seriesClasses(series);
  const show = format ?? ((value: number) => formatChartValue(value, unit));
  const axis = formatAxis ?? ((value: number) => compactFormat.format(value));
  const { min, max } = chartDomain(domainValues(rows, series));
  const y = (value: number) => round(PLOT_H - ((value - min) / (max - min)) * PLOT_H);
  const width = round(100 / rows.length);
  const hover = (i: number) => {
    const row = rows[i] as ChartRow;
    return `${row.label}: ${series.map((s) => `${s.label} ${isGap(row.values[s.key]) ? 'no data' : show(row.values[s.key] as number)}`).join(', ')}`;
  };
  const hasGap = rows.some((row) => series.some((s) => isGap(row.values[s.key])));
  const ticks = xTicks(rows.length);
  const tableView = view === 'table';

  return (
    <figure className="ak-chart" data-kind={kind} aria-label={title} data-testid={testId}>
      <div className="ak-chart-head">
        {(series.length > 1 || hasGap) && (
          <ul className="ak-chart-legend">
            {series.length > 1 &&
              series.map((s) => (
                <li key={s.key}>
                  <span
                    className={cx('ak-chart-key', classes.get(s.key), lineKeys && 'ak-chart-key-line', s.compare != null && 'ak-chart-key-dashed')}
                    aria-hidden="true"
                  />
                  {s.label}
                </li>
              ))}
            {hasGap && (
              <li>
                <span className="ak-chart-key ak-chart-key-gap" aria-hidden="true" />
                No data (not zero)
              </li>
            )}
          </ul>
        )}
        {unit && <span className="ak-chart-unit">{unit}</span>}
        {tableView && (
          // The table form is also the chart's CSV export: the same rows, gaps empty, never 0.
          <Button
            size="sm"
            variant="ghost"
            className="ak-chart-export"
            data-testid={childId(testId, 'action.export')}
            onClick={() => downloadCsv(csvFilename ?? title, chartCsv(rows, series, xLabel, total))}
          >
            Export CSV
          </Button>
        )}
        <Button size="sm" variant="ghost" className="ak-chart-toggle" data-testid={childId(testId, 'action.table')} onClick={() => setView(tableView ? 'chart' : 'table')}>
          {tableView ? 'Show as chart' : 'Show as table'}
        </Button>
      </div>
      {!tableView && (
        <div className="ak-chart-body" aria-hidden="true">
          <div className="ak-chart-y">
            <span>{axis(max)}</span>
            <span>{axis((max + min) / 2)}</span>
            <span>{axis(min)}</span>
          </div>
          <div className="ak-chart-plot">
            <svg className="ak-chart-svg" viewBox={`0 0 100 ${PLOT_H}`} preserveAspectRatio="none" focusable="false">
              {[0, PLOT_H / 2, PLOT_H].map((at) => (
                <line key={at} className="ak-chart-grid" x1="0" x2="100" y1={at} y2={at} />
              ))}
              <line className="ak-chart-base" x1="0" x2="100" y1={y(0)} y2={y(0)} />
              {plot({ rows, series, classes, y, band: (i) => ({ x: round(i * width), width }), hover })}
              {rows.map((row, i) => (
                <rect key={row.key} className="ak-chart-hit" x={round(i * width)} y="0" width={width} height={PLOT_H}>
                  <title>{hover(i)}</title>
                </rect>
              ))}
            </svg>
            <div className="ak-chart-x">
              {rows.map((row, i) => (
                <span key={row.key} className={cx(ticks[i] === 'minor' && 'ak-chart-tick-minor')}>
                  {ticks[i] && <span>{row.label}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* The table is always present: on screen in the table view, for screen readers in both. */}
      <ChartTable
        title={title}
        rows={rows}
        series={series}
        unit={unit}
        format={show}
        {...(xLabel != null && { xLabel })}
        total={total}
        className={tableView ? undefined : 'ak-sr-only'}
        {...(testId != null && { 'data-testid': testId })}
      />
    </figure>
  );
}

/** A dashed mark on the zero line across a slot: "no reading here", which is not zero. */
function GapMark({ x, width, y }: { x: number; width: number; y: number }) {
  return <line className="ak-chart-gap" x1={x} x2={x + width} y1={y} y2={y} />;
}

// ─── Bar chart ───────────────────────────────────────────

export interface BarChartProps extends ChartProps {
  /** Stack the series in one bar per x position, instead of side by side. */
  stacked?: boolean;
}

/** Inner share of a band a bar group fills; the rest is the gap between groups. */
const BAR_FILL = 0.72;

/**
 * Bars over categories or time, side by side or stacked. A missing reading draws a dashed mark
 * on the zero line (side by side), or a dashed cap on the stack (stacked), never a zero bar.
 */
export function BarChart({ stacked = false, ...props }: BarChartProps) {
  return (
    <ChartFrame
      props={props}
      kind="bar"
      total={stacked}
      domainValues={(rows, series) =>
        rows.flatMap((row) => {
          const known = series.map((s) => row.values[s.key]).filter((v): v is number => !isGap(v));
          if (!stacked) return known;
          return [known.filter((v) => v > 0).reduce((a, b) => a + b, 0), known.filter((v) => v < 0).reduce((a, b) => a + b, 0)];
        })
      }
      plot={({ rows, series, classes, y, band }) =>
        rows.map((row, i) => {
          const { x, width } = band(i);
          const inner = round(width * BAR_FILL);
          const left = round(x + (width - inner) / 2);
          const zero = y(0);
          if (stacked) {
            let up = 0;
            let down = 0;
            const missing = series.some((s) => isGap(row.values[s.key]));
            const segments = series.map((s) => {
              const value = row.values[s.key];
              if (isGap(value) || value === 0) return null;
              const from = value > 0 ? up : down;
              const to = from + value;
              if (value > 0) up = to;
              else down = to;
              return <rect key={s.key} className={cx('ak-chart-bar', classes.get(s.key))} x={left} width={inner} y={Math.min(y(from), y(to))} height={Math.abs(y(from) - y(to))} />;
            });
            const top = y(up);
            return (
              <g key={row.key} data-gap={missing || undefined}>
                {segments}
                {missing &&
                  (up === 0 && down === 0 ? (
                    <GapMark x={left} width={inner} y={zero} />
                  ) : (
                    <rect className="ak-chart-gap" x={left} width={inner} y={Math.max(0, top - 8)} height={Math.min(8, top)} />
                  ))}
              </g>
            );
          }
          const slot = round(inner / series.length);
          return (
            <g key={row.key}>
              {series.map((s, j) => {
                const value = row.values[s.key];
                const bx = round(left + j * slot);
                if (isGap(value)) return <GapMark key={s.key} x={bx} width={slot} y={zero} />;
                if (value === 0) return null;
                return <rect key={s.key} className={cx('ak-chart-bar', classes.get(s.key))} x={bx} width={slot} y={Math.min(zero, y(value))} height={Math.abs(zero - y(value))} />;
              })}
            </g>
          );
        })
      }
    />
  );
}

// ─── Line chart ──────────────────────────────────────────

/**
 * Lines over time. A series with `compare` set (last month against this month) is dashed in its
 * target's colour. A missing reading breaks the line, never dips it to zero; a lone reading
 * between gaps is a dot; an x position with no reading in any series gets a dashed mark.
 */
export function LineChart(props: ChartProps) {
  return (
    <ChartFrame
      props={props}
      kind="line"
      lineKeys
      domainValues={(rows, series) => rows.flatMap((row) => series.map((s) => row.values[s.key]).filter((v): v is number => !isGap(v)))}
      plot={({ rows, series, classes, y, band }) => {
        const cx0 = (i: number) => {
          const { x, width } = band(i);
          return x + width / 2;
        };
        const lines = series.map((s) => {
          const runs: string[][] = [];
          let run: string[] = [];
          rows.forEach((row, i) => {
            const value = row.values[s.key];
            if (isGap(value)) {
              if (run.length) runs.push(run);
              run = [];
            } else run.push(`${cx0(i)} ${y(value)}`);
          });
          if (run.length) runs.push(run);
          // Runs of two or more readings are one (possibly dashed) path. A single-reading run is a separate
          // zero-length segment with round caps: a dot, which stays undashed so a dashed series still paints it.
          const d = runs.filter((r) => r.length > 1).map((r) => `M${r.join('L')}`).join('');
          const dots = runs.filter((r) => r.length === 1).map((r) => `M${r[0]}h0`).join('');
          const slot = classes.get(s.key);
          return (
            <Fragment key={s.key}>
              {d && <path className={cx('ak-chart-line', slot, s.compare != null && 'ak-chart-line-dashed')} d={d} data-series={s.key} />}
              {dots && <path className={cx('ak-chart-line', 'ak-chart-dot', slot)} d={dots} data-series={s.key} />}
            </Fragment>
          );
        });
        const gaps = rows.map((row, i) =>
          series.every((s) => isGap(row.values[s.key])) ? <GapMark key={row.key} {...band(i)} y={y(0)} /> : null,
        );
        return (
          <>
            {gaps}
            {lines}
          </>
        );
      }}
    />
  );
}
