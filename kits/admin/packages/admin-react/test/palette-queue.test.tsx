import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CommandPalette, QueueLayout, filterCommands, type CommandItem, type QueueAction } from '../src/index.js';

const PAGES: CommandItem[] = [
  { id: 'money-budget', label: 'Budget', group: 'Pages', keywords: 'money' },
  { id: 'sales-leads', label: 'Leads', group: 'Pages', keywords: 'sales' },
  { id: 'ops-health', label: 'Health', group: 'Pages' },
];

const palette = () => document.querySelector('dialog.ak-palette') as HTMLDialogElement;

describe('CommandPalette', () => {
  function Harness({ onSelect = () => {}, search }: { onSelect?: (item: CommandItem) => void; search?: (q: string, s: AbortSignal) => Promise<ReadonlyArray<CommandItem>> }) {
    return (
      <>
        <button type="button">Somewhere</button>
        <input aria-label="Note" />
        <CommandPalette items={PAGES} onSelect={onSelect} search={search} data-testid="shell.search" />
      </>
    );
  }

  it('opens on / and Ctrl+K, but not while typing in a field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('textbox', { name: 'Note' }));
    await user.keyboard('/');
    expect(palette().open).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('/');
    await user.click(screen.getByRole('button', { name: 'Somewhere' }));
    await user.keyboard('/');
    expect(palette().open).toBe(true);
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(palette().open).toBe(false);
    expect(screen.getByRole('button', { name: 'Somewhere' })).toHaveFocus();
    await user.keyboard('{Control>}k{/Control}');
    expect(palette().open).toBe(true);
  });

  it('filters, moves with the arrow keys and picks with Enter', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Somewhere' }));
    await user.keyboard('/');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByText('Pages')).toHaveClass('ak-palette-group');
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('sales');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Leads']);
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(PAGES[1]);
    expect(palette().open).toBe(false);
  });

  it('adds results from the search call, latest answer only', async () => {
    const user = userEvent.setup();
    const search = vi.fn(async (q: string) => [{ id: `person-${q}`, label: `Person ${q}`, group: 'People' }]);
    render(<Harness search={search} />);
    await user.click(screen.getByRole('button', { name: 'Somewhere' }));
    await user.keyboard('/');
    await user.keyboard('ana');
    expect(await screen.findByRole('option', { name: 'Person ana' })).toBeInTheDocument();
    expect(search).toHaveBeenLastCalledWith('ana', expect.any(AbortSignal));
    expect(screen.getByText('People')).toBeInTheDocument();
  });

  it('ranks labels that start with the text first', () => {
    const items: CommandItem[] = [{ id: 'a', label: 'Old leads' }, { id: 'b', label: 'Leads' }];
    expect(filterCommands(items, 'lead').map((i) => i.id)).toEqual(['b', 'a']);
  });
});

interface Item {
  id: string;
  title: string;
}

function Queue({ initial, onRun = () => {}, fail }: { initial: Item[]; onRun?: (action: string, id: string) => void; fail?: string }) {
  const [items, setItems] = useState(initial);
  const [focused, setFocused] = useState<string | null>(null);
  const actions = (item: Item): QueueAction[] => [
    {
      id: 'approve',
      label: 'Approve',
      tone: 'primary',
      run: async () => {
        onRun('approve', item.id);
        if (fail) throw new Error(fail);
        setItems((all) => all.filter((i) => i.id !== item.id));
      },
    },
    { id: 'skip', label: 'Skip', run: () => onRun('skip', item.id) },
  ];
  return (
    <>
      <input aria-label="Draft" />
      <QueueLayout
        label="Decide"
        data-testid="ops-decide.queue"
        items={items}
        itemId={(i) => i.id}
        focusedId={focused}
        onFocusChange={setFocused}
        renderItem={(i) => i.title}
        renderDetail={(i) => <h3>{i.title}</h3>}
        actions={actions}
        kinds={[
          { value: 'all', label: 'All', count: items.length },
          { value: 'reply', label: 'Replies', count: 1 },
        ]}
        kind="all"
        onKindChange={() => {}}
        errors={[]}
      />
    </>
  );
}

const ITEMS: Item[] = [
  { id: 'a', title: 'Reply to issue 12' },
  { id: 'b', title: 'Lead from the fair' },
  { id: 'c', title: 'Event on Friday' },
];

const focusedRow = () => screen.getAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true')?.getAttribute('data-row-id');

describe('QueueLayout', () => {
  it('focuses the first item, and j/k move', async () => {
    const user = userEvent.setup();
    render(<Queue initial={ITEMS} />);
    await waitFor(() => expect(focusedRow()).toBe('a'));
    expect(screen.getByRole('heading', { name: 'Reply to issue 12' })).toBeInTheDocument();
    await user.keyboard('j');
    expect(focusedRow()).toBe('b');
    await user.keyboard('jj');
    expect(focusedRow()).toBe('c');
    await user.keyboard('k');
    expect(focusedRow()).toBe('b');
    expect(screen.getAllByTestId('ops-decide.queue.row').map((r) => r.dataset.rowId)).toEqual(['a', 'b', 'c']);
  });

  it('runs actions by number key and advances to the next item afterwards', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<Queue initial={ITEMS} onRun={onRun} />);
    await waitFor(() => expect(focusedRow()).toBe('a'));
    await user.keyboard('1');
    expect(onRun).toHaveBeenCalledWith('approve', 'a');
    await waitFor(() => expect(focusedRow()).toBe('b'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    // A non-removing action still advances.
    await user.keyboard('2');
    expect(onRun).toHaveBeenLastCalledWith('skip', 'b');
    await waitFor(() => expect(focusedRow()).toBe('c'));
    // At the end it moves back to the one before.
    await user.click(screen.getByTestId('ops-decide.queue.action.approve'));
    await waitFor(() => expect(focusedRow()).toBe('b'));
  });

  it('lands on the item after a removed middle item, not the first', async () => {
    const user = userEvent.setup();
    render(<Queue initial={ITEMS} />);
    await waitFor(() => expect(focusedRow()).toBe('a'));
    await user.keyboard('j');
    expect(focusedRow()).toBe('b');
    await user.keyboard('1');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    await waitFor(() => expect(focusedRow()).toBe('c'));
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('data-row-id'))).toEqual(['a', 'c']);
  });

  it('focuses the first item when the list empties and refills', async () => {
    const user = userEvent.setup();
    function Reload() {
      const [items, setItems] = useState<Item[]>(ITEMS);
      const [focused, setFocused] = useState<string | null>(null);
      return (
        <>
          <button type="button" onClick={() => setItems([])}>
            Empty
          </button>
          <button type="button" onClick={() => setItems([{ id: 'x', title: 'X' }, { id: 'y', title: 'Y' }, { id: 'z', title: 'Z' }])}>
            Refill
          </button>
          <QueueLayout label="Decide" items={items} itemId={(i) => i.id} focusedId={focused} onFocusChange={setFocused} renderItem={(i) => i.title} renderDetail={(i) => <h3>{i.title}</h3>} />
        </>
      );
    }
    render(<Reload />);
    await waitFor(() => expect(focusedRow()).toBe('a'));
    await user.keyboard('jj');
    expect(focusedRow()).toBe('c');
    await user.click(screen.getByRole('button', { name: 'Empty' }));
    await user.click(screen.getByRole('button', { name: 'Refill' }));
    await waitFor(() => expect(focusedRow()).toBe('x'));
  });

  it('keeps a deep-linked focus while the list is still loading', async () => {
    const onFocusChange = vi.fn();
    const props = { label: 'Decide', itemId: (i: Item) => i.id, focusedId: 'b', onFocusChange, renderItem: (i: Item) => i.title, renderDetail: (i: Item) => <h3>{i.title}</h3> };
    const { rerender } = render(<QueueLayout {...props} items={[]} loading />);
    await act(async () => {});
    expect(onFocusChange).not.toHaveBeenCalled();
    rerender(<QueueLayout {...props} items={ITEMS} />);
    await act(async () => {});
    expect(onFocusChange).not.toHaveBeenCalled();
    expect(focusedRow()).toBe('b');
  });

  it('stays put and shows the message when an action fails', async () => {
    const user = userEvent.setup();
    render(<Queue initial={ITEMS} fail="Gone on the server" />);
    await waitFor(() => expect(focusedRow()).toBe('a'));
    await user.keyboard('1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Gone on the server');
    expect(focusedRow()).toBe('a');
  });

  it('ignores the keys while typing in a field', async () => {
    const user = userEvent.setup();
    const onRun = vi.fn();
    render(<Queue initial={ITEMS} onRun={onRun} />);
    await waitFor(() => expect(focusedRow()).toBe('a'));
    await user.click(screen.getByRole('textbox', { name: 'Draft' }));
    await user.keyboard('j1');
    expect(focusedRow()).toBe('a');
    expect(onRun).not.toHaveBeenCalled();
  });

  it('shows number hints on the actions and counts on the kind filter', async () => {
    render(<Queue initial={ITEMS} />);
    await waitFor(() => expect(focusedRow()).toBe('a'));
    expect(screen.getByTestId('ops-decide.queue.action.approve')).toHaveAttribute('aria-keyshortcuts', '1');
    expect(screen.getByRole('button', { name: 'All 3' })).toBeInTheDocument();
  });

  it('shows an all-clear empty state', () => {
    render(<Queue initial={[]} />);
    expect(screen.getByTestId('ops-decide.queue.empty')).toHaveTextContent('Nothing waiting on you');
  });
});
