import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  AdminShell,
  Badge,
  Card,
  EmptyRow,
  EmptyState,
  NavGroup,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatCard,
  StatGrid,
  Table,
  Td,
  Th,
  buttonClass,
  entityGridClasses,
  navItemClass,
} from '../src/index.js';

function Shell() {
  return (
    <AdminShell
      brand={<a href="/admin">Example Admin</a>}
      nav={(close) => (
        <NavGroup label="Sales">
          <a href="#orders" className={navItemClass(true)} aria-current="page" onClick={close}>
            Orders
          </a>
          <a href="#refunds" className={navItemClass(false)} onClick={close}>
            Refunds
          </a>
        </NavGroup>
      )}
      footer={<span>Signed in</span>}
    >
      <PageHeader title="Orders" description="Every sale." actions={<button type="button">Export</button>} />
    </AdminShell>
  );
}

describe('AdminShell', () => {
  it('renders the grouped nav, the footer and the page', () => {
    render(<Shell />);
    const nav = screen.getByRole('navigation', { name: 'Admin' });
    const group = within(nav).getByRole('group', { name: 'Sales' });
    expect(within(group).getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeInTheDocument();
  });

  it('opens the phone drawer and closes it with Esc, the scrim or a link', async () => {
    const user = userEvent.setup();
    const { container } = render(<Shell />);
    const shell = container.querySelector('.ak-shell') as HTMLElement;
    const menu = screen.getByRole('button', { name: 'Menu' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');

    await user.click(menu);
    expect(shell).toHaveAttribute('data-nav-open');
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
    expect(container.querySelector('.ak-main')).toHaveAttribute('inert');

    await user.keyboard('{Escape}');
    expect(shell).not.toHaveAttribute('data-nav-open');
    expect(menu).toHaveFocus();
    expect(container.querySelector('.ak-main')).not.toHaveAttribute('inert');

    await user.click(menu);
    fireEvent.click(container.querySelector('.ak-scrim') as HTMLElement);
    expect(shell).not.toHaveAttribute('data-nav-open');

    await user.click(menu);
    await user.click(screen.getByRole('link', { name: 'Refunds' }));
    expect(shell).not.toHaveAttribute('data-nav-open');
  });
});

describe('AdminShell on a widening window', () => {
  it('sends focus to the current link when the drawer closes for desktop', async () => {
    const user = userEvent.setup();
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let desktop = false;
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return desktop;
      },
      media: query,
      addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.delete(fn),
    })) as unknown as typeof window.matchMedia;
    try {
      render(<Shell />);
      await user.click(screen.getByRole('button', { name: 'Menu' }));
      expect(screen.getByRole('button', { name: 'Close menu' })).toHaveFocus();
      desktop = true;
      act(() => listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent)));
      expect(screen.getByRole('link', { name: 'Orders' })).toHaveFocus();
    } finally {
      window.matchMedia = original;
    }
  });
});

describe('page pieces', () => {
  it('leaves out wrappers for props that are false', () => {
    const show = false;
    const { container } = render(
      <>
        <PageHeader title="Orders" back={show && <a href="/">Back</a>} actions={show && 'x'} />
        <Card title={show && 'Recent'} footer={show && 'more'}>
          body
        </Card>
        <EmptyState title="Nothing" action={show && <button type="button">Clear</button>} />
      </>,
    );
    expect(container.querySelector('.ak-page-back, .ak-actions, .ak-card-head, .ak-card-foot, .ak-empty-action')).toBeNull();
  });

  it('Card shows a title, actions and a footer', () => {
    render(
      <Card title="Recent" actions={<button type="button">All</button>} footer="3 of 40">
        body
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Recent' })).toBeInTheDocument();
    expect(screen.getByText('3 of 40')).toHaveClass('ak-card-foot');
  });

  it('StatGrid and StatCard emit the kit classes', () => {
    const { container } = render(
      <StatGrid cols={4}>
        <StatCard label="Revenue" value="$1,200" note="this month" />
      </StatGrid>,
    );
    expect(container.firstChild).toHaveClass('ak-stats', 'ak-stats-cols-4');
    expect(screen.getByText('$1,200')).toHaveClass('ak-stat-value');
  });

  it('Badge always carries its text', () => {
    render(<Badge tone="success">Active</Badge>);
    expect(screen.getByText('Active')).toHaveClass('ak-badge', 'ak-badge-success');
  });

  it('buttonClass maps the variants', () => {
    expect(buttonClass()).toBe('ak-btn');
    expect(buttonClass('primary', 'sm')).toBe('ak-btn ak-btn-primary ak-btn-sm');
    expect(buttonClass('quietDanger')).toBe('ak-btn ak-btn-quiet-danger');
  });
});

describe('Table', () => {
  it('scrolls inside its card and aligns numbers', () => {
    const { container } = render(
      <Table>
        <thead>
          <tr>
            <Th>Buyer</Th>
            <Th align="right">Price</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>a@example.com</Td>
            <Td num>$49</Td>
          </tr>
          <EmptyRow cols={2}>Nothing else</EmptyRow>
        </tbody>
      </Table>,
    );
    expect(container.firstChild).toHaveClass('ak-card', 'ak-table-wrap');
    expect(screen.getByRole('table')).toHaveClass('ak-table');
    expect(screen.getByText('$49')).toHaveClass('ak-right', 'ak-num');
    expect(screen.getByText('Nothing else')).toHaveAttribute('colspan', '2');
  });

  it('entityGridClasses covers every EntityGrid className prop', () => {
    expect(Object.keys(entityGridClasses).sort()).toEqual(
      ['cellClassName', 'className', 'headerClassName', 'paginationClassName', 'rowClassName', 'searchClassName'].sort(),
    );
    expect(entityGridClasses.className).toBe('ak-table');
  });
});

describe('states', () => {
  it('EmptyState tells "no data" from "all clear"', () => {
    render(
      <>
        <EmptyState title="No purchases yet">They show here once someone buys.</EmptyState>
        <EmptyState kind="all-clear" title="All caught up" />
      </>,
    );
    const noData = screen.getByText('No purchases yet').closest('.ak-empty');
    const clear = screen.getByText('All caught up').closest('.ak-empty');
    expect(noData).toHaveAttribute('data-kind', 'no-data');
    expect(noData).not.toHaveClass('ak-empty-calm');
    expect(clear).toHaveAttribute('data-kind', 'all-clear');
    expect(clear).toHaveClass('ak-empty-calm');
  });

  it('Skeleton is hidden from assistive technology', () => {
    const { container } = render(<Skeleton lines={3} />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.ak-skel')).toHaveLength(3);
  });

  it('Skeleton renders no style attribute unless asked for a size', () => {
    const { container } = render(<Skeleton lines={3} />);
    for (const bar of container.querySelectorAll('.ak-skel')) expect(bar).not.toHaveAttribute('style');

    const sized = render(<Skeleton lines={2} width={120} height={20} />).container;
    const [first, last] = Array.from(sized.querySelectorAll<HTMLElement>('.ak-skel')) as [HTMLElement, HTMLElement];
    expect(first.style.width).toBe('120px');
    expect(first.style.height).toBe('20px');
    expect(last.style.width).toBe('');
    expect(last.style.height).toBe('20px');
  });
});

describe('SegmentedControl', () => {
  function Rule() {
    const [value, setValue] = useState<'default' | 'silence' | 'trash'>('default');
    return (
      <SegmentedControl
        label="Sender rule"
        value={value}
        onChange={setValue}
        options={[
          { value: 'default', label: 'Default' },
          { value: 'silence', label: 'Silence' },
          { value: 'trash', label: 'Trash', danger: true },
        ]}
      />
    );
  }

  it('presses exactly one option', async () => {
    const user = userEvent.setup();
    render(<Rule />);
    const group = screen.getByRole('group', { name: 'Sender rule' });
    await user.click(within(group).getByRole('button', { name: 'Trash' }));
    expect(within(group).getByRole('button', { name: 'Trash' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Trash' })).toHaveClass('ak-seg-danger');
    expect(within(group).getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'false');
  });
});
