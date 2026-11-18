import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  FilterBar,
  FilterSearch,
  FilterSegment,
  FilterSelect,
  PeriodControl,
  UrlStateProvider,
  decodePeriod,
  encodePeriod,
  hashParamsAdapter,
  previousRange,
  resolvePeriod,
  stepMonth,
  usePeriodParam,
  useUrlParam,
  useUrlParams,
  type Period,
} from '../src/index.js';

const TODAY = new Date(Date.UTC(2026, 10, 14, 22, 30)); // 2026-11-14, late in the UTC day

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('period arithmetic (UTC days, inclusive)', () => {
  it('resolves every preset', () => {
    expect(resolvePeriod({ preset: 'today' }, TODAY)).toEqual({ from: '2026-11-14', to: '2026-11-14' });
    expect(resolvePeriod({ preset: '7d' }, TODAY)).toEqual({ from: '2026-11-08', to: '2026-11-14' });
    expect(resolvePeriod({ preset: '30d' }, TODAY)).toEqual({ from: '2026-10-16', to: '2026-11-14' });
    expect(resolvePeriod({ preset: 'thisMonth' }, TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-14' });
    expect(resolvePeriod({ preset: 'lastMonth' }, TODAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(resolvePeriod({ preset: 'month', month: '2024-02' }, TODAY)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(resolvePeriod({ preset: 'thisYear' }, TODAY)).toEqual({ from: '2026-01-01', to: '2026-11-14' });
    expect(resolvePeriod({ preset: 'custom', from: '2026-11-10', to: '2026-11-01' }, TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-10' });
  });

  it('crosses a January boundary', () => {
    const jan = new Date(Date.UTC(2027, 0, 3));
    expect(resolvePeriod({ preset: 'lastMonth' }, jan)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(stepMonth('2027-01', -1)).toBe('2026-12');
    expect(stepMonth('2026-12', 1)).toBe('2027-01');
  });

  it('finds the previous period for compare', () => {
    const p7: Period = { preset: '7d' };
    expect(previousRange(p7, resolvePeriod(p7, TODAY))).toEqual({ from: '2026-11-01', to: '2026-11-07' });
    const month: Period = { preset: 'month', month: '2026-03' };
    expect(previousRange(month, resolvePeriod(month, TODAY))).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    const mtd: Period = { preset: 'thisMonth' };
    expect(previousRange(mtd, resolvePeriod(mtd, TODAY))).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    const ytd: Period = { preset: 'thisYear' };
    expect(previousRange(ytd, resolvePeriod(ytd, TODAY))).toEqual({ from: '2025-01-01', to: '2025-11-14' });
    // Month-to-date on the 31st compares with a shorter month, clamped to its end.
    const may31 = new Date(Date.UTC(2026, 4, 31));
    expect(previousRange(mtd, resolvePeriod(mtd, may31))).toEqual({ from: '2026-04-01', to: '2026-04-30' });
  });

  it('round-trips through the address', () => {
    const periods: Period[] = [{ preset: '7d' }, { preset: 'month', month: '2026-10' }, { preset: 'custom', from: '2026-11-01', to: '2026-11-09' }, { preset: 'thisYear' }];
    for (const period of periods) expect(decodePeriod(encodePeriod(period))).toEqual(period);
    expect(decodePeriod('bogus')).toBeNull();
    expect(decodePeriod('2026-13')).toBeNull();
    expect(decodePeriod('2026-02-30x..')).toBeNull();
    expect(decodePeriod('2026-02-31..2026-03-05')).toBeNull();
    expect(decodePeriod('2026-02-28..2026-03-05')).toEqual({ preset: 'custom', from: '2026-02-28', to: '2026-03-05' });
    expect(resolvePeriod({ preset: 'custom', from: '2026-02-31', to: '2026-03-05' }, TODAY)).toEqual({ from: '2026-03-05', to: '2026-11-14' });
  });
});

function Bound({ today = TODAY }: { today?: Date }) {
  const p = usePeriodParam({ today, defaultPeriod: { preset: '30d' } });
  return <PeriodControl value={p.period} onChange={p.setPeriod} compare={p.compare} onCompareChange={p.setCompare} today={today} data-testid="money-budget.period" />;
}

describe('PeriodControl', () => {
  it('shows presets and the resolved days, and binds to the address', async () => {
    const user = userEvent.setup();
    render(<Bound />);
    expect(screen.getByTestId('money-budget.period.range')).toHaveTextContent('2026-10-16 – 2026-11-14');
    expect(window.location.search).toBe('');
    await user.click(screen.getByRole('button', { name: '7 days' }));
    expect(window.location.search).toBe('?period=7d');
    expect(screen.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('money-budget.period.range')).toHaveTextContent('2026-11-08 – 2026-11-14');
    // Back to the default drops the parameter.
    await user.click(screen.getByRole('button', { name: '30 days' }));
    expect(window.location.search).toBe('');
  });

  it('steps months and stops at the current one', async () => {
    const user = userEvent.setup();
    render(<Bound />);
    await user.click(screen.getByRole('button', { name: 'Month' }));
    expect(window.location.search).toBe('?period=2026-11');
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(window.location.search).toBe('?period=2026-09');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    expect(screen.getByTestId('money-budget.period.range')).toHaveTextContent('2026-09-01 – 2026-09-30');
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(window.location.search).toBe('?period=2026-10');
  });

  it('toggles compare and shows the previous days', async () => {
    const user = userEvent.setup();
    render(<Bound />);
    await user.click(screen.getByRole('button', { name: '7 days' }));
    await user.click(screen.getByRole('checkbox', { name: 'vs previous period' }));
    expect(window.location.search).toBe('?period=7d&compare=1');
    expect(screen.getByTestId('money-budget.period.range')).toHaveTextContent('2026-11-08 – 2026-11-14 vs 2026-11-01 – 2026-11-07');
  });

  it('reads the address on load and follows back and forward', async () => {
    window.history.replaceState(null, '', '/?period=lastMonth');
    const user = userEvent.setup();
    render(<Bound />);
    expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(window.location.search).toBe('?period=today');
    act(() => {
      window.history.replaceState(null, '', '/?period=lastMonth');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('button', { name: 'Last month' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('edits a custom range on native date inputs', async () => {
    const user = userEvent.setup();
    render(<Bound />);
    await user.click(screen.getByRole('button', { name: 'Custom' }));
    expect(window.location.search).toBe('?period=2026-10-16..2026-11-14');
    const from = screen.getByLabelText('From') as HTMLInputElement;
    expect(from.type).toBe('date');
    expect(from.value).toBe('2026-10-16');
  });
});

describe('URL binding through the hash', () => {
  function Status() {
    const [status, setStatus] = useUrlParam('status', { defaultValue: 'open' });
    return (
      <FilterSegment
        label="Status"
        value={status ?? 'open'}
        onChange={(v) => setStatus(v)}
        options={[
          { value: 'open', label: 'Open', count: 14 },
          { value: 'won', label: 'Won', count: 3 },
        ]}
        data-testid="sales-leads.filter.status"
      />
    );
  }

  it('keeps the route and writes the query inside the hash', async () => {
    window.history.replaceState(null, '', '/#/sales/leads');
    const user = userEvent.setup();
    render(
      <UrlStateProvider adapter={hashParamsAdapter}>
        <Status />
      </UrlStateProvider>,
    );
    expect(screen.getByTestId('sales-leads.filter.status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Won 3' })).toHaveAttribute('aria-pressed', 'false');
    await user.click(screen.getByRole('button', { name: 'Won 3' }));
    expect(window.location.hash).toBe('#/sales/leads?status=won');
    act(() => {
      window.history.replaceState(null, '', '/#/sales/leads');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('button', { name: 'Open 14' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('FilterBar and field filters', () => {
  it('reports search text after a pause, or at once on Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterSearch value="" onChange={onChange} delay={30} data-testid="p.filter.q" />);
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'acme');
    expect(onChange).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 60));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('acme');
    await user.type(screen.getByRole('searchbox'), 'x{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('acmex');
  });

  it('drops a pending search commit when the value changes from outside', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<FilterSearch value="x" onChange={onChange} delay={40} />);
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'y');
    rerender(<FilterSearch value="" onChange={onChange} delay={40} />);
    await new Promise((r) => setTimeout(r, 80));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('');
  });

  it('offers Clear filters only when a filter is active', async () => {
    const user = userEvent.setup();
    function Bar() {
      const [kind, setKind] = useState<'' | 'a' | 'b'>('');
      return (
        <FilterBar activeCount={kind ? 1 : 0} onClear={() => setKind('')} data-testid="p.filters">
          <FilterSelect label="Kind" value={kind} onChange={setKind} options={[{ value: 'a', label: 'Alpha', count: 2 }, { value: 'b', label: 'Beta' }]} />
        </FilterBar>
      );
    }
    render(<Bar />);
    expect(screen.getByRole('group', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Kind'), 'a');
    expect(screen.getByRole('option', { name: 'Alpha (2)' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByLabelText('Kind')).toHaveValue('');
  });
});

describe('useUrlParams', () => {
  // The address encodes values per URLSearchParams (RFC 3986 percent-encoding: '&' is %26,
  // '+' is %2B, '%' is %25), so the hook must read back the exact string that was set.
  it('round-trips values containing &, + and % through the address and back', () => {
    const { result } = renderHook(() => useUrlParams(['q'] as const));
    expect(result.current[0].q).toBeNull();
    act(() => result.current[1]({ q: 'R&D' }));
    expect(window.location.search).toBe('?q=R%26D');
    expect(result.current[0].q).toBe('R&D');
    act(() => result.current[1]({ q: 'a+b' }));
    expect(window.location.search).toBe('?q=a%2Bb');
    expect(result.current[0].q).toBe('a+b');
    act(() => result.current[1]({ q: '100%' }));
    expect(window.location.search).toBe('?q=100%25');
    expect(result.current[0].q).toBe('100%');
  });

  it('reads values already in the address without decoding them twice', () => {
    window.history.replaceState(null, '', '/?q=R%26D&t=a%2Bb');
    const { result } = renderHook(() => useUrlParams(['q', 't'] as const));
    expect(result.current[0]).toEqual({ q: 'R&D', t: 'a+b' });
  });
});
