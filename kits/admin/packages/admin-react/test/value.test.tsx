// Proofs of the kit's value-rendering rules (the `ui` claims for part 1.7 of the design).
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CopyValue,
  DefinitionList,
  MixedMoneyError,
  Value,
  assertOneMoneyKind,
  formatMoney,
  formatRelative,
  formatUtcDay,
  safeHref,
  sumMoney,
} from '../src/index.js';

const NOW = Date.UTC(2026, 10, 14, 12, 0, 0);

describe('rule: an unknown value renders as "—", never 0 or an empty string', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['blank text', '  '],
    ['NaN', Number.NaN],
  ])('%s', (_name, value) => {
    for (const kind of ['text', 'number', 'money', 'date', 'timestamp', 'badge', 'url', 'multiline'] as const) {
      const view = kind === 'money' ? { kind, moneyKind: 'billed' as const } : { kind };
      const { container, unmount } = render(<Value {...view} value={value} data-testid="cell" />);
      const cell = screen.getByTestId('cell');
      expect(cell).toHaveAttribute('data-unknown');
      expect(cell.textContent).toBe('—unknown');
      expect(container.textContent).not.toMatch(/\b0\b/);
      unmount();
    }
  });

  it('keeps a real zero as zero', () => {
    render(<Value kind="money" moneyKind="billed" value={0} data-testid="zero" />);
    expect(screen.getByTestId('zero')).toHaveTextContent('$0.00');
  });

  it('applies to DefinitionList values too', () => {
    render(<DefinitionList data-testid="p.fields" items={[{ key: 'owner', label: 'Owner', value: null }, { key: 'note', label: 'Note', value: '' }]} />);
    expect(screen.getByTestId('p.fields.owner')).toHaveTextContent('—');
    expect(screen.getByTestId('p.fields.note')).toHaveTextContent('—');
  });
});

describe('rule: money shows its sign and cents, and billed never totals with notional', () => {
  it('formats sign and cents', () => {
    expect(formatMoney(-1234.5)).toBe('-$1,234.50');
    expect(formatMoney(5)).toBe('$5.00');
    expect(formatMoney(1999, { unit: 'minor' })).toBe('$19.99');
    expect(formatMoney(12, { signed: true })).toBe('+$12.00');
    expect(formatMoney(-0.5, { currency: 'EUR' })).toBe('-€0.50');
  });

  it('marks the money kind on the element, and notional is told apart without colour', () => {
    render(
      <>
        <Value kind="money" moneyKind="billed" value={-20} data-testid="billed" />
        <Value kind="money" moneyKind="notional" value={41} data-testid="notional" />
      </>,
    );
    expect(screen.getByTestId('billed')).toHaveAttribute('data-money-kind', 'billed');
    expect(screen.getByTestId('billed')).toHaveTextContent('-$20.00');
    expect(screen.getByTestId('notional')).toHaveAttribute('data-money-kind', 'notional');
    expect(screen.getByTestId('notional')).toHaveTextContent('$41.00 (notional)');
  });

  it('refuses to total or chart billed with notional, or two currencies', () => {
    expect(sumMoney([{ amount: 1, moneyKind: 'billed' }, { amount: 2.5, moneyKind: 'billed' }])).toEqual({ amount: 3.5, moneyKind: 'billed', currency: 'USD' });
    expect(() => sumMoney([{ amount: 1, moneyKind: 'billed' }, { amount: 2, moneyKind: 'notional' }])).toThrow(MixedMoneyError);
    expect(() => sumMoney([{ amount: 1, moneyKind: 'billed', currency: 'USD' }, { amount: 2, moneyKind: 'billed', currency: 'EUR' }])).toThrow(MixedMoneyError);
    expect(() => assertOneMoneyKind(['billed', 'notional'])).toThrow(MixedMoneyError);
    expect(() => assertOneMoneyKind(['notional', 'notional'])).not.toThrow();
    expect(sumMoney([])).toBeNull();
  });
});

describe('rule: a date is a UTC day, never shifted by the browser zone', () => {
  const zone = process.env.TZ;
  afterEach(() => {
    process.env.TZ = zone;
  });

  it.each(['America/Los_Angeles', 'Pacific/Auckland', 'UTC'])('in %s', (tz) => {
    process.env.TZ = tz;
    expect(formatUtcDay('2026-11-14')).toBe('2026-11-14');
    expect(formatUtcDay('2026-11-14T23:30:00-08:00')).toBe('2026-11-15');
    render(<Value kind="date" value="2026-03-01" data-testid={`d-${tz}`} />);
    expect(screen.getByTestId(`d-${tz}`)).toHaveTextContent('2026-03-01');
    expect(screen.getByTestId(`d-${tz}`)).toHaveAttribute('dateTime', '2026-03-01');
  });

  it('the zone really differs in the test (a local reading would shift the day)', () => {
    process.env.TZ = 'America/Los_Angeles';
    expect(new Date('2026-03-01').getDate()).toBe(28);
  });
});

describe('rule: a timestamp is relative, with the exact time on hover', () => {
  it('formats relative times', () => {
    expect(formatRelative(NOW - 10_000, NOW)).toBe('just now');
    expect(formatRelative(NOW - 12 * 60_000, NOW)).toBe('12 min ago');
    expect(formatRelative(NOW - (59 * 60_000 + 40_000), NOW)).toBe('59 min ago');
    expect(formatRelative(NOW - 60 * 60_000, NOW)).toBe('1 h ago');
    expect(formatRelative(NOW - 3 * 3_600_000, NOW)).toBe('3 h ago');
    expect(formatRelative(NOW - 2 * 86_400_000, NOW)).toBe('2 d ago');
    expect(formatRelative(NOW + 5 * 60_000, NOW)).toBe('in 5 min');
    expect(formatRelative(NOW - 45 * 86_400_000, NOW)).toBe('2026-09-30');
  });

  it('puts the exact UTC time in the title and the machine time in dateTime', () => {
    render(<Value kind="timestamp" value={new Date(NOW - 3 * 3_600_000 - 14_000)} now={NOW} data-testid="ts" />);
    const ts = screen.getByTestId('ts');
    expect(ts.tagName).toBe('TIME');
    expect(ts).toHaveTextContent('3 h ago');
    expect(ts).toHaveAttribute('title', '2026-11-14 08:59:46 UTC');
    expect(ts).toHaveAttribute('dateTime', '2026-11-14T08:59:46.000Z');
  });
});

describe('rule: an enum renders as a badge with a tone per value', () => {
  it('maps values to tones and labels', () => {
    render(
      <>
        <Value kind="badge" value="won" tones={{ won: 'success', lost: 'danger' }} labels={{ won: 'Won' }} data-testid="a" />
        <Value kind="badge" value="other" tones={{ won: 'success' }} data-testid="b" />
      </>,
    );
    expect(screen.getByTestId('a')).toHaveClass('ak-badge', 'ak-badge-success');
    expect(screen.getByTestId('a')).toHaveTextContent('Won');
    expect(screen.getByTestId('b')).toHaveClass('ak-badge');
    expect(screen.getByTestId('b').className).not.toMatch(/ak-badge-(success|danger)/);
  });
});

describe('rule: a reference links to its record', () => {
  it('renders a link', () => {
    render(<Value kind="reference" value="A. Example" href="#/people/42" />);
    expect(screen.getByRole('link', { name: 'A. Example' })).toHaveAttribute('href', '#/people/42');
  });
});

describe('rule: an external link is http or https only, with safe rel, in a new tab; untrusted text stays text', () => {
  it('links http and https', () => {
    render(<Value kind="url" value="https://example.com/a?b=1" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://example.com/a?b=1');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x</b>', 'mailto:a@example.com', '//example.com', 'example.com', ' javascript:alert(1)', 'http//x'])('%s stays text', (value) => {
    const { container } = render(<Value kind="url" value={value} />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe(value);
    expect(safeHref(value)).toBeNull();
  });

  it('never renders HTML from the value', () => {
    const { container } = render(<Value kind="url" value={'<img src=x onerror=alert(1)>'} />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('rule: a read-only textarea keeps its line breaks as plain text', () => {
  it('preserves breaks and never parses HTML', () => {
    render(<Value kind="multiline" value={'line one\nline two\n<b>not bold</b>'} data-testid="body" />);
    const body = screen.getByTestId('body');
    expect(body).toHaveClass('ak-multiline');
    expect(body.textContent).toBe('line one\nline two\n<b>not bold</b>');
    expect(body.querySelector('b')).toBeNull();
  });
});

describe('CopyValue', () => {
  it('copies the value and announces it', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<CopyValue value="req_8f3a" data-testid="id" />);
    await user.click(screen.getByRole('button', { name: 'Copy req_8f3a' }));
    expect(writeText).toHaveBeenCalledWith('req_8f3a');
    expect(screen.getByRole('status')).toHaveTextContent('Copied');
  });

  it('reports a failed copy', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    render(<CopyValue value="abc" />);
    await user.click(screen.getByRole('button', { name: 'Copy abc' }));
    expect(screen.getByRole('status')).toHaveTextContent('Copy failed');
  });

  it('shows "—" and no button for an unknown value', () => {
    render(<CopyValue value={null} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.body).toHaveTextContent('—');
  });
});

describe('DefinitionList', () => {
  it('renders groups of labelled values with test ids', () => {
    render(
      <DefinitionList
        data-testid="app.site.fields"
        groups={[
          { title: 'Site', items: [{ key: 'host', label: 'Host', value: 'example.com' }] },
          { title: 'Runbook', items: [{ key: 'runbook', label: 'Steps', value: <Value kind="multiline" value={'a\nb'} />, wide: true }] },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Site' })).toBeInTheDocument();
    expect(screen.getByTestId('app.site.fields.host')).toHaveTextContent('example.com');
    expect(screen.getByText('Steps').closest('.ak-dl-row')).toHaveClass('ak-dl-wide');
  });
});

describe('relative timestamps tick', () => {
  it('re-renders on the shared clock', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(NOW);
      render(<Value kind="timestamp" value={NOW - 30_000} data-testid="t" />);
      expect(screen.getByTestId('t')).toHaveTextContent('just now');
      act(() => {
        vi.setSystemTime(NOW + 60_000);
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByTestId('t')).toHaveTextContent('2 min ago');
    } finally {
      vi.useRealTimers();
    }
  });
});
