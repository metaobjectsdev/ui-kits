import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BarChart,
  ChartTable,
  LineChart,
  MAX_SERIES,
  Meter,
  OTHER_KEY,
  Sparkline,
  StatCard,
  Table,
  Td,
  chartCsv,
  chartDomain,
  checkChartUnits,
  foldSeries,
  isGap,
  niceBound,
  xTicks,
  type ChartRow,
  type ChartSeries,
} from '../src/index.js';

const rows: ChartRow[] = [
  { key: '2026-11-01', label: 'Nov 1', values: { a: 4, b: 2 } },
  { key: '2026-11-02', label: 'Nov 2', values: { a: null, b: 3 } },
  { key: '2026-11-03', label: 'Nov 3', values: { a: 0, b: 1 } },
];
const series: ChartSeries[] = [
  { key: 'a', label: 'Alpha' },
  { key: 'b', label: 'Beta' },
];

const wide = (count: number): { rows: ChartRow[]; series: ChartSeries[] } => {
  const many = Array.from({ length: count }, (_, i) => ({ key: `s${i}`, label: `Series ${i}` }));
  return {
    series: many,
    rows: [
      // Series i is worth i, so the largest are the last ones.
      { key: 'r1', label: 'R1', values: Object.fromEntries(many.map((s, i) => [s.key, i])) },
      { key: 'r2', label: 'R2', values: Object.fromEntries(many.map((s, i) => [s.key, i < count - 5 ? null : i])) },
    ],
  };
};

describe('chart data rules', () => {
  it('treats null, undefined and non-finite numbers as gaps, and zero as a reading', () => {
    expect([null, undefined, Number.NaN, Infinity].every(isGap)).toBe(true);
    expect(isGap(0)).toBe(false);
  });

  it('one unit per chart: a series naming another unit is a typed mixed-units refusal', () => {
    expect(checkChartUnits('USD', [{ key: 'a', label: 'A', unit: 'USD' }, { key: 'b', label: 'B' }])).toEqual({ ok: true, unit: 'USD' });
    expect(checkChartUnits('USD billed', [{ key: 'a', label: 'A', unit: 'USD notional' }])).toEqual({
      ok: false,
      code: 'mixed-units',
      units: ['USD billed', 'USD notional'],
    });
  });

  it('at most six series: more fold into the top five and "Other"', () => {
    const data = wide(8);
    expect(foldSeries(data.rows, data.series.slice(0, 6)).series).toHaveLength(6);
    const folded = foldSeries(data.rows, data.series);
    expect(folded.series).toHaveLength(MAX_SERIES);
    expect(folded.series.map((s) => s.key)).toEqual(['s3', 's4', 's5', 's6', 's7', OTHER_KEY]);
    expect(folded.series.at(-1)?.label).toBe('Other');
    // Row 1: Other = 0 + 1 + 2. Row 2: every folded series is a gap, so Other is a gap, not 0.
    expect(folded.rows[0]?.values[OTHER_KEY]).toBe(3);
    expect(folded.rows[1]?.values[OTHER_KEY]).toBeNull();
  });

  it('keeps a comparison series beside its target when folding', () => {
    const data = wide(7);
    const withCompare = [...data.series, { key: 'prev', label: 'Last month', compare: 's6' }];
    const folded = foldSeries(data.rows, withCompare);
    expect(folded.series).toHaveLength(MAX_SERIES);
    expect(folded.series.map((s) => s.key)).toEqual(['s3', 's4', 's5', 's6', 'prev', OTHER_KEY]);
  });

  it('rounds the axis outwards and always includes zero', () => {
    expect(niceBound(87)).toBe(100);
    expect(niceBound(2.1)).toBe(2.5);
    expect(niceBound(-13)).toBe(-20);
    expect(chartDomain([3, 7])).toEqual({ min: 0, max: 10 });
    expect(chartDomain([-3, 7])).toEqual({ min: -5, max: 10 });
    expect(chartDomain([])).toEqual({ min: 0, max: 1 });
  });

  it('writes the same rows as CSV, a gap as an empty cell, never 0', () => {
    expect(chartCsv(rows, series, 'Day')).toBe('Day,Alpha,Beta\r\nNov 1,4,2\r\nNov 2,,3\r\nNov 3,0,1\r\n');
    expect(chartCsv([{ key: 'k', label: 'A, "B"', values: {} }], [{ key: 'x', label: 'X' }])).toBe('Label,X\r\n"A, ""B""",\r\n');
  });

  it('adds the Total column the table shows, empty on a gap, and defuses formula labels', () => {
    expect(chartCsv(rows, series, 'Day', true)).toBe('Day,Alpha,Beta,Total\r\nNov 1,4,2,6\r\nNov 2,,3,\r\nNov 3,0,1,1\r\n');
    expect(chartCsv([{ key: 'k', label: '=SUM(A1)', values: { x: -2 } }], [{ key: 'x', label: 'X' }])).toBe("Label,X\r\n'=SUM(A1),-2\r\n");
    // A number is never a formula, so it is written raw even in exponent form (ECMAScript
    // Number::toString: String(-1e-7) is '-1e-7').
    expect(chartCsv([{ key: 'e', label: 'E', values: { x: -1e-7 } }], [{ key: 'x', label: 'X' }])).toBe('Label,X\r\nE,-1e-7\r\n');
  });

  it('"Export CSV" in the table view downloads the table rows, Total column included', async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        created.push(blob);
        return 'blob:x';
      }),
      revokeObjectURL: vi.fn(),
    });
    let saved = '';
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved = this.download;
    });
    const chart = (stacked: boolean) => (
      <BarChart stacked={stacked} title="Orders by day" rows={rows} series={series} unit="orders" xLabel="Day" data-testid="p.b" csvFilename="orders" />
    );
    const { rerender } = render(chart(false));
    // Only the table view offers it.
    expect(screen.queryByTestId('p.b.action.export')).toBeNull();
    await user.click(screen.getByTestId('p.b.action.table'));
    await user.click(screen.getByTestId('p.b.action.export'));
    expect(saved).toBe('orders.csv');
    expect(await created[0]!.text()).toBe('Day,Alpha,Beta\r\nNov 1,4,2\r\nNov 2,,3\r\nNov 3,0,1\r\n');
    // A stacked chart shows a Total column, and the export carries it. The view state survives
    // the rerender, so the table view is still open.
    rerender(chart(true));
    await user.click(screen.getByTestId('p.b.action.export'));
    expect(await created[1]!.text()).toBe('Day,Alpha,Beta,Total\r\nNov 1,4,2,6\r\nNov 2,,3,\r\nNov 3,0,1,1\r\n');
    click.mockRestore();
  });
});

describe('BarChart', () => {
  it('draws a gap as a dashed mark and the unknown mark in the table, never a zero bar', () => {
    const { container } = render(<BarChart title="Orders" rows={rows} series={series} unit="orders" data-testid="sales.orders" />);
    const figure = screen.getByTestId('sales.orders');
    expect(figure.tagName).toBe('FIGURE');
    // Nov 2's Alpha is a gap: one dashed mark. Nov 3's Alpha is a zero: no bar and no gap mark.
    expect(container.querySelectorAll('.ak-chart-gap')).toHaveLength(1);
    expect(container.querySelectorAll('.ak-chart-bar')).toHaveLength(4);
    const nov2 = container.querySelector('[data-row-id="2026-11-02"]') as HTMLElement;
    expect(within(nov2).getAllByTestId('sales.orders.a')[0]).toHaveTextContent('—no data');
    const nov3 = container.querySelector('[data-row-id="2026-11-03"]') as HTMLElement;
    expect(within(nov3).getByTestId('sales.orders.a')).toHaveTextContent('0 orders');
    // A legend line tells the reader what the dashed mark means.
    expect(within(figure).getByText('No data (not zero)')).toBeInTheDocument();
  });

  it('hover text names the x label and each series value', () => {
    const { container } = render(<BarChart title="Orders" rows={rows} series={series} unit="orders" format={(v) => `${v} pcs`} />);
    const titles = [...container.querySelectorAll('.ak-chart-hit title')].map((t) => t.textContent);
    expect(titles).toEqual(['Nov 1: Alpha 4 pcs, Beta 2 pcs', 'Nov 2: Alpha no data, Beta 3 pcs', 'Nov 3: Alpha 0 pcs, Beta 1 pcs']);
  });

  it('stacks, and a stack with a gap gets a dashed cap and an unknown total', () => {
    const { container } = render(<BarChart stacked title="Orders" rows={rows} series={series} unit="orders" data-testid="p.b" />);
    expect(container.querySelectorAll('g[data-gap]')).toHaveLength(1);
    expect(container.querySelector('g[data-gap] rect.ak-chart-gap')).not.toBeNull();
    const totals = screen.getAllByTestId('p.b.total').map((td) => td.textContent);
    expect(totals).toEqual(['6 orders', '—no data', '1 orders']);
  });

  it('refuses a chart that mixes units, with a typed error', () => {
    const { container } = render(
      <BarChart title="Spend" rows={rows} series={[{ key: 'a', label: 'Alpha', unit: 'USD billed' }, { key: 'b', label: 'Beta', unit: 'USD notional' }]} unit="USD billed" data-testid="p.spend" />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('p.spend.error')).toHaveAttribute('data-error', 'mixed-units');
  });

  it('shows an empty state with no rows', () => {
    render(<BarChart title="Orders" rows={[]} series={series} unit="orders" data-testid="p.b" empty="No orders yet" />);
    expect(screen.getByTestId('p.b.empty')).toHaveTextContent('No orders yet');
  });

  it('folds past six series and colours each slot from the series palette', () => {
    const data = wide(9);
    const { container } = render(<BarChart title="Mix" rows={data.rows} series={data.series} unit="" />);
    const legend = [...container.querySelectorAll('.ak-chart-legend li')].map((li) => li.textContent);
    expect(legend.slice(0, 6)).toEqual(['Series 4', 'Series 5', 'Series 6', 'Series 7', 'Series 8', 'Other']);
    const keys = [...container.querySelectorAll('.ak-chart-legend .ak-chart-key')].slice(0, 6).map((k) => k.className);
    expect(keys).toEqual([
      'ak-chart-key ak-chart-s1',
      'ak-chart-key ak-chart-s2',
      'ak-chart-key ak-chart-s3',
      'ak-chart-key ak-chart-s4',
      'ak-chart-key ak-chart-s5',
      'ak-chart-key ak-chart-s-other',
    ]);
  });

  it('"Show as table" toggles by keyboard; the table is the accessible form in both views', async () => {
    const user = userEvent.setup();
    const { container } = render(<BarChart title="Orders by day" rows={rows} series={series} unit="orders" data-testid="p.b" xLabel="Day" />);
    // Chart view: the drawing is hidden from assistive tech, the table is there but visually hidden.
    expect(container.querySelector('.ak-chart-body')).toHaveAttribute('aria-hidden', 'true');
    const table = screen.getByRole('table', { name: 'Orders by day (orders)' });
    expect(table.closest('.ak-chart-table')).toHaveClass('ak-sr-only');
    expect(screen.getAllByTestId('p.b.row').map((tr) => tr.getAttribute('data-row-id'))).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);

    const toggle = screen.getByTestId('p.b.action.table');
    expect(toggle).toHaveTextContent('Show as table');
    await user.tab();
    expect(toggle).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('table').closest('.ak-chart-table')).not.toHaveClass('ak-sr-only');
    expect(screen.getByRole('columnheader', { name: 'Day' })).toBeInTheDocument();
    expect(toggle).toHaveTextContent('Show as chart');
    await user.keyboard(' ');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('phone width: at most four labels stay on a narrow chart, eight on a wide one', () => {
    for (const count of [1, 3, 4, 7, 12, 31, 365]) {
      const ticks = xTicks(count);
      expect(ticks.filter(Boolean).length).toBeLessThanOrEqual(8);
      expect(ticks.filter((t) => t === 'major').length).toBeLessThanOrEqual(4);
      expect(ticks[0]).toBe('major');
    }
    const month = Array.from({ length: 30 }, (_, i) => ({ key: `d${i}`, label: `D${i + 1}`, values: { a: i } }));
    const { container } = render(<BarChart title="Month" rows={month} series={[series[0] as ChartSeries]} unit="" />);
    expect(container.querySelectorAll('.ak-chart-x > span')).toHaveLength(30);
    expect(container.querySelectorAll('.ak-chart-x > span:not(.ak-chart-tick-minor) > span')).toHaveLength(4);
    // components.css hides the minor labels in a chart 480px wide or less; `pnpm check:css` parses components.css and fails unless that rule exists.
  });
});

describe('LineChart', () => {
  it('breaks the line at a gap and draws a lone reading as a dot', () => {
    const line: ChartRow[] = [
      { key: '1', label: '1', values: { a: 1 } },
      { key: '2', label: '2', values: { a: 2 } },
      { key: '3', label: '3', values: { a: null } },
      { key: '4', label: '4', values: { a: 5 } },
      { key: '5', label: '5', values: {} },
    ];
    const { container } = render(<LineChart title="Trend" rows={line} series={[{ key: 'a', label: 'A' }]} unit="" />);
    const d = container.querySelector('path.ak-chart-line:not(.ak-chart-dot)')?.getAttribute('d') ?? '';
    expect(d.match(/M/g)).toHaveLength(1);
    expect(container.querySelector('path.ak-chart-dot')?.getAttribute('d')).toMatch(/^M\S+ \S+h0$/);
    // Rows 3 and 5 have no reading in any series: a dashed mark each.
    expect(container.querySelectorAll('.ak-chart-gap')).toHaveLength(2);
  });

  it('draws a comparison series dashed in its target colour, taking no palette slot', () => {
    const data: ChartRow[] = [
      { key: '1', label: 'Day 1', values: { now: 1, prev: 2, other: 1 } },
      { key: '2', label: 'Day 2', values: { now: 3, prev: 3, other: 2 } },
    ];
    const { container } = render(
      <LineChart
        title="Spend"
        rows={data}
        series={[
          { key: 'now', label: 'This month' },
          { key: 'prev', label: 'Last month', compare: 'now' },
          { key: 'other', label: 'Fees' },
        ]}
        unit="USD"
      />,
    );
    const cls = (key: string) => container.querySelector(`path[data-series="${key}"]:not(.ak-chart-dot)`)?.getAttribute('class');
    expect(cls('now')).toBe('ak-chart-line ak-chart-s1');
    expect(cls('prev')).toBe('ak-chart-line ak-chart-s1 ak-chart-line-dashed');
    expect(cls('other')).toBe('ak-chart-line ak-chart-s2');
    expect(container.querySelector('.ak-chart-key-dashed')?.parentElement).toHaveTextContent('Last month');
  });
});

describe('LineChart lone comparison reading', () => {
  it('draws a lone reading on a dashed series as an undashed dot in its target colour', () => {
    const data: ChartRow[] = [
      { key: '1', label: '1', values: { now: 1, prev: 2 } },
      { key: '2', label: '2', values: { now: 3, prev: null } },
      { key: '3', label: '3', values: { now: 2, prev: 4 } },
    ];
    const { container } = render(
      <LineChart
        title="Spend"
        rows={data}
        series={[
          { key: 'now', label: 'Now' },
          { key: 'prev', label: 'Prev', compare: 'now' },
        ]}
        unit="USD"
      />,
    );
    const dots = container.querySelectorAll('path.ak-chart-dot[data-series="prev"]');
    expect(dots).toHaveLength(1);
    const dot = dots[0] as Element;
    expect(dot.getAttribute('class')).toBe('ak-chart-line ak-chart-dot ak-chart-s1');
    expect(dot.getAttribute('class')).not.toContain('ak-chart-line-dashed');
    // Both of prev's runs are single readings, so no dashed path remains for it.
    expect(container.querySelector('path.ak-chart-line-dashed')).toBeNull();
  });
});

describe('ChartTable', () => {
  it('renders the rows with stable test ids, unknowns as "—" and an optional total', () => {
    render(<ChartTable title="T" rows={rows} series={series} unit="" total data-testid="p.t" />);
    expect(screen.getAllByTestId('p.t.row')).toHaveLength(3);
    expect(screen.getAllByTestId('p.t.b').map((td) => td.textContent)).toEqual(['2', '3', '1']);
    expect(screen.getAllByTestId('p.t.total').map((td) => td.textContent)).toEqual(['6', '—no data', '1']);
  });
});

describe('Sparkline', () => {
  it('renders "—", not a flat zero line, when there is no reading', () => {
    render(<Sparkline values={[null, null]} label="Orders" data-testid="p.b.trend" />);
    const cell = screen.getByTestId('p.b.trend');
    expect(cell).toHaveTextContent('—Orders: no data');
    expect(cell.querySelector('svg')).toBeNull();
  });

  it('breaks the line at a gap and names latest, low and high', () => {
    render(<Sparkline values={[1, 3, null, 2]} label="Orders" labels={['Mon', 'Tue', 'Wed', 'Thu']} />);
    const svg = screen.getByRole('img', { name: 'Orders: latest 2, low 1, high 3' });
    expect(svg.querySelector('path')?.getAttribute('d')?.match(/M/g)).toHaveLength(2);
    expect([...svg.querySelectorAll('title')].map((t) => t.textContent)).toEqual(['Mon: 1', 'Tue: 3', 'Wed: no data', 'Thu: 2']);
  });

  it('names "latest no data" when the newest slot is a gap, not the last known reading', () => {
    render(<Sparkline values={[1, 3, null]} label="Orders" />);
    expect(screen.getByRole('img', { name: 'Orders: latest no data, low 1, high 3' })).toBeInTheDocument();
  });

  it('bar form: a measured zero keeps a stub, a gap draws nothing', () => {
    const { container } = render(<Sparkline kind="bar" values={[0, null, 4]} label="Orders" />);
    const bars = container.querySelectorAll('rect.ak-spark-bar');
    expect(bars).toHaveLength(2);
    expect(Number(bars[0]?.getAttribute('height'))).toBeGreaterThan(0);
  });

  it('works inline in a table cell and in a stat tile', () => {
    render(
      <>
        <Table>
          <tbody>
            <tr>
              <Td data-testid="p.list.trend">
                <Sparkline values={[1, 2, 3]} label="Row trend" />
              </Td>
            </tr>
          </tbody>
        </Table>
        <StatCard label="Orders" value="12" note={<Sparkline values={[1, 2]} label="Tile trend" />} />
      </>,
    );
    expect(within(screen.getByTestId('p.list.trend')).getByRole('img', { name: /^Row trend/ })).toHaveClass('ak-sparkline');
    expect(screen.getByRole('img', { name: /^Tile trend/ }).closest('.ak-stat')).not.toBeNull();
  });
});

describe('Meter', () => {
  it('is a meter with the value, the limit and the share in words', () => {
    render(<Meter value={40} max={100} label="Budget" format={(v) => `$${v}`} data-testid="p.stats.budget" />);
    const meter = screen.getByRole('meter', { name: 'Budget' });
    expect(meter).toHaveAttribute('aria-valuenow', '40');
    expect(meter).toHaveAttribute('aria-valuetext', '$40 of $100 (40%)');
    expect(meter).toHaveAttribute('data-tone', 'default');
    expect(meter.querySelector('.ak-meter-fill')).toHaveAttribute('width', '40');
    expect(screen.getByTestId('p.stats.budget')).toBe(meter);
  });

  it('past the limit: full bar, the real share, danger tone; warnAt turns to warning', () => {
    render(<Meter value={130} max={100} label="Over" />);
    const over = screen.getByRole('meter', { name: 'Over' });
    expect(over).toHaveAttribute('aria-valuenow', '100');
    expect(over).toHaveAttribute('aria-valuetext', '130 of 100 (130%)');
    expect(over).toHaveClass('ak-meter-danger');
    expect(over.querySelector('.ak-meter-fill')).toHaveAttribute('width', '100');
    render(<Meter value={85} max={100} warnAt={0.8} label="Near" />);
    expect(screen.getByRole('meter', { name: 'Near' })).toHaveClass('ak-meter-warning');
  });

  it('renders "—" for an unknown value or limit, never an empty bar', () => {
    render(
      <>
        <Meter value={null} max={100} label="A" data-testid="p.a" />
        <Meter value={5} max={0} label="B" data-testid="p.b" />
      </>,
    );
    expect(screen.queryByRole('meter')).toBeNull();
    expect(screen.getByTestId('p.a')).toHaveTextContent('—A: no data');
    expect(screen.getByTestId('p.b')).toHaveTextContent('—B: no data');
  });

  it('inline form for a table cell, and a stale badge', () => {
    render(
      <>
        <Meter inline value={1} max={4} label="Cell" />
        <Meter stale value={1} max={4} label="Tile" />
      </>,
    );
    const cell = screen.getByRole('meter', { name: 'Cell' });
    expect(cell).toHaveClass('ak-meter-inline');
    expect(cell).toHaveTextContent('25%');
    expect(cell.querySelector('.ak-meter-of')).toBeNull();
    const tile = screen.getByRole('meter', { name: 'Tile' });
    expect(tile).toHaveAttribute('aria-valuetext', '1 of 4 (25%), stale');
    expect(within(tile).getByText('stale')).toHaveClass('ak-badge');
  });
});
