import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button, DataTable, toCsv, type DataColumn } from '../src/index.js';

interface Lead {
  id: string;
  name: string;
  stage: string;
  value: number | null;
  due: string | null;
  site: string | null;
}

const columns: DataColumn<Lead>[] = [
  { key: 'name', header: 'Contact', primary: true },
  { key: 'stage', header: 'Stage', view: { kind: 'badge', tones: { won: 'success' } } },
  { key: 'value', header: 'Value', view: { kind: 'money', moneyKind: 'notional' } },
  { key: 'due', header: 'Follow up', view: { kind: 'date' } },
  { key: 'site', header: 'Site', view: { kind: 'url' }, csv: false },
];

const lead = (n: number, extra: Partial<Lead> = {}): Lead => ({
  id: `L${n}`,
  name: `Contact ${n}`,
  stage: n % 2 ? 'talking' : 'won',
  value: n * 100,
  due: `2026-11-${String((n % 28) + 1).padStart(2, '0')}`,
  site: null,
  ...extra,
});

describe('DataTable', () => {
  it('emits the stable test ids, data-row-id and phone labels', () => {
    render(<DataTable label="Leads" data-testid="sales-leads.table" columns={columns} rows={[lead(1), lead(2, { value: null })]} rowId={(r) => r.id} />);
    const rows = screen.getAllByTestId('sales-leads.table.row');
    expect(rows.map((r) => r.getAttribute('data-row-id'))).toEqual(['L1', 'L2']);
    const cells = within(rows[1]!).getAllByTestId(/^sales-leads\.table\./);
    expect(cells.map((c) => c.getAttribute('data-testid'))).toEqual([
      'sales-leads.table.name',
      'sales-leads.table.stage',
      'sales-leads.table.value',
      'sales-leads.table.due',
      'sales-leads.table.site',
    ]);
    // Every cell carries its label for the stacked phone layout.
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['Contact', 'Stage', 'Value', 'Follow up', 'Site']);
    // The value rules apply inside cells: unknown is "—".
    expect(within(rows[1]!).getByTestId('sales-leads.table.value')).toHaveTextContent('—');
    expect(within(rows[0]!).getByTestId('sales-leads.table.value')).toHaveTextContent('$100.00');
    expect(screen.getByRole('table', { name: 'Leads' })).toBeInTheDocument();
  });

  it('pages 50 rows at a time by default', async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 120 }, (_, i) => lead(i + 1));
    render(<DataTable label="Leads" data-testid="t" columns={columns} rows={rows} rowId={(r) => r.id} />);
    expect(screen.getAllByTestId('t.row')).toHaveLength(50);
    expect(screen.getByTestId('t.pager')).toHaveTextContent('1–50 of 120');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByTestId('t.row')).toHaveLength(20);
    expect(screen.getByTestId('t.pager')).toHaveTextContent('101–120 of 120');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('pages on the server when given a total', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<DataTable label="Leads" data-testid="t" columns={columns} rows={[lead(51), lead(52)]} rowId={(r) => r.id} page={2} total={230} onPageChange={onPageChange} />);
    expect(screen.getAllByTestId('t.row')).toHaveLength(2);
    expect(screen.getByTestId('t.pager')).toHaveTextContent('51–100 of 230');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('groups rows under headings with counts', () => {
    render(
      <DataTable
        label="Activity"
        columns={columns}
        rows={[lead(1, { due: '2026-11-14' }), lead(2, { due: '2026-11-13' }), lead(3, { due: '2026-11-14' })]}
        rowId={(r) => r.id}
        groupBy={(r) => r.due ?? ''}
        groupLabel={(key) => `Day ${key}`}
      />,
    );
    const headings = screen.getAllByRole('columnheader', { name: /^Day / });
    expect(headings.map((h) => h.textContent)).toEqual(['Day 2026-11-142', 'Day 2026-11-131']);
    const groups = document.querySelectorAll('tbody');
    expect(within(groups[0] as HTMLElement).getAllByRole('row')).toHaveLength(3);
  });

  it('puts row actions in a keyboard-driven menu', async () => {
    const user = userEvent.setup();
    const won = vi.fn();
    render(
      <DataTable
        label="Leads"
        data-testid="sales-leads.table"
        columns={columns}
        rows={[lead(1)]}
        rowId={(r) => r.id}
        rowActions={(row) => [
          { id: 'won', label: 'Won', onSelect: () => won(row.id) },
          { id: 'lost', label: 'Lost', tone: 'danger', onSelect: () => {} },
          { id: 'hand-back', label: 'Hand back', disabled: true, onSelect: () => {} },
        ]}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Actions for L1' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(trigger);
    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Won' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Lost' })).toHaveFocus();
    await user.keyboard('{ArrowDown}'); // the disabled item is skipped
    expect(within(menu).getByRole('menuitem', { name: 'Won' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(screen.getByTestId('sales-leads.table.action.won')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(won).toHaveBeenCalledWith('L1');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes the menu on an outside click', async () => {
    const user = userEvent.setup();
    render(<DataTable label="Leads" columns={columns} rows={[lead(1)]} rowId={(r) => r.id} rowActions={() => [{ id: 'a', label: 'A', onSelect: () => {} }]} />);
    await user.click(screen.getByRole('button', { name: 'Actions for L1' }));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('selects rows, selects all on the page, and hands the bulk actions the rows', async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    function Harness() {
      const [selected, setSelected] = useState<Set<string>>(new Set());
      return (
        <DataTable
          label="Leads"
          data-testid="t"
          columns={columns}
          rows={[lead(1), lead(2), lead(3)]}
          rowId={(r) => r.id}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          bulkActions={({ ids, rows }, clear) => (
            <Button
              size="sm"
              onClick={() => {
                archive(ids, rows.map((r) => r.id));
                clear();
              }}
            >
              Archive
            </Button>
          )}
        />
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: 'Select row L2' }));
    expect(screen.getByTestId('t.bulk')).toHaveTextContent('1 selected');
    const all = screen.getByRole('checkbox', { name: 'Select all rows on this page' }) as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    await user.click(all);
    expect(screen.getByTestId('t.bulk')).toHaveTextContent('3 selected');
    expect(screen.getAllByTestId('t.row').every((r) => r.getAttribute('aria-selected') === 'true')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    // ids in selection order (L2 was picked first); rows in table order.
    expect(archive).toHaveBeenCalledWith(['L2', 'L1', 'L3'], ['L1', 'L2', 'L3']);
    expect(screen.queryByTestId('t.bulk')).toBeNull();
  });

  it('keeps a selection across server pages: the bulk action gets every selected id and the loaded rows', async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    function Harness() {
      const [page, setPage] = useState(1);
      const [selected, setSelected] = useState<Set<string>>(new Set());
      return (
        <DataTable
          label="Leads"
          data-testid="t"
          columns={columns}
          rows={[lead(page * 50 + 1), lead(page * 50 + 2)]}
          rowId={(r) => r.id}
          page={page}
          total={230}
          onPageChange={setPage}
          selectable
          selected={selected}
          onSelectionChange={setSelected}
          bulkActions={({ ids, rows }) => (
            <Button
              size="sm"
              onClick={() => {
                archive(ids, rows.map((r) => r.id));
              }}
            >
              Archive
            </Button>
          )}
        />
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: 'Select row L51' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select row L101' }));
    // The bar counts every selected id, not just this page's.
    expect(screen.getByTestId('t.bulk')).toHaveTextContent('2 selected');
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    // Every selected id, across pages, plus only the selected rows that are loaded.
    expect(archive).toHaveBeenCalledWith(['L51', 'L101'], ['L101']);
  });

  it('a client table counts and hands over only selected rows still in its rows', async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    function Harness() {
      const [selected, setSelected] = useState<Set<string>>(new Set());
      const [query, setQuery] = useState('');
      const rows = [lead(1), lead(2), lead(3)].filter((r) => r.name.includes(query));
      return (
        <>
          <button type="button" onClick={() => setQuery('2')}>
            Filter
          </button>
          <DataTable
            label="Leads"
            data-testid="t"
            columns={columns}
            rows={rows}
            rowId={(r) => r.id}
            selectable
            selected={selected}
            onSelectionChange={setSelected}
            bulkActions={({ ids, rows: picked }) => <Button onClick={() => archive(ids, picked.map((r) => r.id))}>Archive</Button>}
          />
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: 'Select row L1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select row L2' }));
    expect(screen.getByTestId('t.bulk')).toHaveTextContent('2 selected');
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    expect(screen.getByTestId('t.bulk')).toHaveTextContent('1 selected');
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(archive).toHaveBeenCalledWith(['L2'], ['L2']);
    const all = screen.getByRole('checkbox', { name: 'Select all rows on this page' }) as HTMLInputElement;
    expect(all.checked).toBe(true);
  });

  it('opens a row from its primary cell or a click on the row', async () => {
    const user = userEvent.setup();
    const onRowOpen = vi.fn();
    render(<DataTable label="Leads" columns={columns} rows={[lead(1)]} rowId={(r) => r.id} onRowOpen={onRowOpen} rowActions={() => [{ id: 'a', label: 'A', onSelect: () => {} }]} />);
    await user.click(screen.getByRole('button', { name: 'Contact 1' }));
    expect(onRowOpen).toHaveBeenCalledTimes(1);
    await user.click(screen.getByText('$100.00'));
    expect(onRowOpen).toHaveBeenCalledTimes(2);
    // The row's own controls do not open it.
    await user.click(screen.getByRole('button', { name: 'Actions for L1' }));
    expect(onRowOpen).toHaveBeenCalledTimes(2);
  });

  it('shows the loading, error and empty states under stable ids', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(<DataTable label="Leads" data-testid="p.b" columns={columns} rows={[]} rowId={(r) => r.id} loading />);
    expect(screen.getByTestId('p.b.loading')).toHaveAttribute('aria-busy', 'true');
    rerender(<DataTable label="Leads" data-testid="p.b" columns={columns} rows={[]} rowId={(r) => r.id} error="Server said no (request r-81)" onRetry={onRetry} />);
    expect(screen.getByTestId('p.b.error')).toHaveTextContent('Server said no (request r-81)');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<DataTable label="Leads" data-testid="p.b" columns={columns} rows={[]} rowId={(r) => r.id} />);
    expect(screen.getByTestId('p.b.empty')).toHaveTextContent('Nothing here yet');
  });

  it('exports CSV of every row, through a download link', async () => {
    const user = userEvent.setup();
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:x';
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const rows = Array.from({ length: 60 }, (_, i) => lead(i + 1));
    render(<DataTable label="Leads" data-testid="t" columns={columns} rows={rows} rowId={(r) => r.id} csv={{ filename: 'leads' }} />);
    await user.click(screen.getByTestId('t.action.export'));
    expect(click).toHaveBeenCalled();
    const text = await created[0]!.text();
    expect(text.split('\r\n')[0]).toBe('Contact,Stage,Value,Follow up');
    expect(text.trim().split('\r\n')).toHaveLength(61);
    click.mockRestore();
  });

  it('shows an inline error, and reports it, when the CSV fetch rejects', async () => {
    const user = userEvent.setup();
    const boom = new Error('server said no');
    const onExportError = vi.fn();
    render(
      <DataTable
        label="Leads"
        data-testid="t"
        columns={columns}
        rows={[lead(1)]}
        rowId={(r) => r.id}
        csv={{ filename: 'leads', rows: () => Promise.reject(boom), onExportError }}
      />,
    );
    await user.click(screen.getByTestId('t.action.export'));
    expect(await screen.findByTestId('t.export.error')).toHaveTextContent('The export failed. Try again.');
    expect(onExportError).toHaveBeenCalledWith(boom);
    // The button stays usable for another attempt.
    expect(screen.getByTestId('t.action.export')).toBeEnabled();
  });
});

describe('toCsv', () => {
  it('quotes, keeps unknown empty, and defuses spreadsheet formulas', () => {
    const csv = toCsv(columns, [
      lead(1, { name: 'Acme, "Inc"', value: null, due: '2026-11-14T23:30:00-08:00' }),
      lead(2, { name: '=HYPERLINK("x")', value: -5 }),
      lead(3, { name: 'line\nbreak', stage: '@risk' }),
      lead(4, { value: -1e-7 }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('"Acme, ""Inc""",talking,,2026-11-15');
    expect(lines[2]).toBe(`"'=HYPERLINK(""x"")",won,-5,2026-11-03`);
    expect(lines[3]).toBe(`"line\nbreak",'@risk,300,2026-11-04`);
    expect(lines[4]).toBe('Contact 4,won,-1e-7,2026-11-05');
  });

  it('writes an empty cell for a date column holding an unparseable value', () => {
    const lines = toCsv(columns, [lead(1, { due: 'not-a-date' })]).split('\r\n');
    expect(lines[1]).toBe('Contact 1,talking,100,');
  });
});
