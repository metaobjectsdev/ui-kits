import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './controls.js';
import { csvCell, downloadCsv } from './csv.js';
import { cx, has } from './cx.js';
import { formatUtcDay, isUnknown, toDate } from './format.js';
import { ActionMenu, type MenuAction } from './menu.js';
import { cardClass } from './page.js';
import { Alert, EmptyState, Skeleton } from './status.js';
import { Value, type ValueView } from './value.js';

export interface DataColumn<Row> {
  /** Stable key: the field name, the default value accessor, and the cell's test id suffix. */
  key: string;
  header: ReactNode;
  /** The raw value. Default: `row[key]`. Used for rendering, CSV and grouping. */
  value?: (row: Row) => unknown;
  /** How the value renders, by the kit's value rules. Default: plain text with "—" for unknown. */
  view?: ValueView;
  /** The referenced record's address, for `view: { kind: 'reference' }`. */
  href?: (row: Row) => string | undefined;
  /** Full control of the cell's content (an InlineEditCell, a sparkline). Overrides `view`. */
  render?: (row: Row) => ReactNode;
  /** The CSV value. Default: the raw value. `false` leaves the column out of the export. */
  csv?: ((row: Row) => string | number | boolean | null | undefined) | false;
  /** Right-aligned with even-width digits. Money and number views are numeric already. */
  num?: boolean;
  /** Lets long text wrap instead of staying on one line. */
  wrap?: boolean;
  /** The row's title: bold, shown first and unlabelled in stacked phone rows, and it opens the row. */
  primary?: boolean;
  /** The label in stacked phone rows, when the header is not plain text. */
  phoneLabel?: string;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataColumn<Row>>;
  /** The rows to show. With `total` set they are one page from the server; otherwise all rows. */
  rows: ReadonlyArray<Row>;
  rowId: (row: Row) => string;
  /** Accessible name of the table. */
  label: string;
  /** The block's test id. Rows get `<id>.row` with `data-row-id`, cells `<id>.<column key>`. */
  'data-testid'?: string;
  /** Group rows under headings, in the order the groups first appear. */
  groupBy?: (row: Row) => string;
  groupLabel?: (key: string, rows: ReadonlyArray<Row>) => ReactNode;
  /** Rows per page. Default 50. */
  pageSize?: number;
  /** The current page, from 1. Leave unset (with onPageChange unset) for client paging. */
  page?: number;
  /** All rows on the server, for server paging. */
  total?: number;
  onPageChange?: (page: number) => void;
  /** The actions in a row's "⋯" menu. */
  rowActions?: (row: Row) => ReadonlyArray<MenuAction>;
  /** Opens the row's detail (a drawer, or a page). The primary cell becomes its button. */
  onRowOpen?: (row: Row) => void;
  /** Adds a checkbox per row and a select-all on the page. */
  selectable?: boolean;
  /** The selected row ids, when the page owns the selection. A client table counts only the ones still in `rows`. */
  selected?: ReadonlySet<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  /**
   * The actions for the selected rows, shown in a bar above the table while any are selected.
   * `ids` holds every selected id (across pages when server-paged; a client table drops ids
   * no longer in `rows`); `rows` holds the selected rows that are currently loaded. The bar's count is `ids.length`, so the action reaches what it counts.
   */
  bulkActions?: (selection: { ids: string[]; rows: Row[] }, clear: () => void) => ReactNode;
  /**
   * Adds "Export CSV". `rows` fetches every matching row for a server-paged table. When the
   * export fails, an inline error shows next to the button and `onExportError` hears the reason.
   */
  csv?: { filename: string; rows?: () => ReadonlyArray<Row> | Promise<ReadonlyArray<Row>>; onExportError?: (error: unknown) => void };
  /** Extra controls in the bar above the table. */
  toolbar?: ReactNode;
  loading?: boolean;
  /** An error message (the server's text and request id). Shown with Retry when onRetry is set. */
  error?: ReactNode;
  onRetry?: () => void;
  /** What an empty table shows. Default: a no-data EmptyState. */
  empty?: ReactNode;
  className?: string;
}

function rawValue<Row>(column: DataColumn<Row>, row: Row): unknown {
  return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key];
}

function labelOf<Row>(column: DataColumn<Row>): string {
  return column.phoneLabel ?? (typeof column.header === 'string' ? column.header : column.key);
}

function isNumeric<Row>(column: DataColumn<Row>): boolean {
  return column.num || column.view?.kind === 'money' || column.view?.kind === 'number';
}

// ─── CSV ─────────────────────────────────────────────────

/** The rows as RFC 4180 CSV, one column per DataColumn not marked `csv: false`. */
export function toCsv<Row>(columns: ReadonlyArray<DataColumn<Row>>, rows: ReadonlyArray<Row>): string {
  const cols = columns.filter((column) => column.csv !== false);
  const lines = [cols.map((column) => csvCell(labelOf(column))).join(',')];
  for (const row of rows) {
    lines.push(
      cols
        .map((column) => {
          if (typeof column.csv === 'function') return csvCell(column.csv(row));
          const value = rawValue(column, row);
          if (column.view?.kind === 'date' && !isUnknown(value)) {
            const day = toDate(value as string);
            return csvCell(Number.isNaN(day.getTime()) ? null : formatUtcDay(day));
          }
          return csvCell(value);
        })
        .join(','),
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}

// ─── DataTable ───────────────────────────────────────────

function SelectBox({ label, checked, indeterminate = false, onChange }: { label: string; checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" className="ak-dtable-check" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} />;
}

/**
 * The table block: optional grouping, paging (50 rows by default), a "⋯" menu of row
 * actions, bulk selection, CSV export and the loading, error and empty states. Under 640px
 * each row stacks as "label: value" lines, with the row actions still in the menu.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowId,
  label,
  'data-testid': testId,
  groupBy,
  groupLabel,
  pageSize = 50,
  page: pageProp,
  total,
  onPageChange,
  rowActions,
  onRowOpen,
  selectable = false,
  selected: selectedProp,
  onSelectionChange,
  bulkActions,
  csv,
  toolbar,
  loading = false,
  error,
  onRetry,
  empty,
  className,
}: DataTableProps<Row>) {
  const [ownPage, setOwnPage] = useState(1);
  const [ownSelected, setOwnSelected] = useState<Set<string>>(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const serverPaged = total != null;
  const page = pageProp ?? ownPage;
  const count = serverPaged ? total : rows.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  const visible = serverPaged ? rows : rows.slice((current - 1) * pageSize, current * pageSize);
  const chosen = selectedProp ?? ownSelected;
  const loadedIds = serverPaged ? null : new Set(rows.map(rowId));
  const selected = loadedIds ? new Set([...chosen].filter((rid) => loadedIds.has(rid))) : chosen;
  const id = (suffix: string) => (testId ? `${testId}.${suffix}` : undefined);

  // Client paging: a shrinking row list moves the page back into range.
  useEffect(() => {
    if (!pageProp && ownPage > pages) setOwnPage(pages);
  }, [pageProp, ownPage, pages]);

  const goTo = (next: number) => {
    if (onPageChange) onPageChange(next);
    if (pageProp == null) setOwnPage(next);
  };
  const setSelected = (next: Set<string>) => {
    if (selectedProp == null) setOwnSelected(next);
    onSelectionChange?.(next);
  };
  const clear = () => setSelected(new Set());

  const visibleIds = visible.map(rowId);
  const pickedOnPage = visibleIds.filter((rid) => selected.has(rid)).length;
  const selectedRows = rows.filter((row) => selected.has(rowId(row)));

  const exportCsv = async () => {
    if (!csv) return;
    setExporting(true);
    setExportError(false);
    try {
      const all = csv.rows ? await csv.rows() : rows;
      downloadCsv(csv.filename, toCsv(columns, all));
    } catch (error) {
      setExportError(true);
      csv.onExportError?.(error);
    } finally {
      setExporting(false);
    }
  };

  const colCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  const groups: Array<{ key: string; rows: Row[] }> = [];
  if (groupBy) {
    const byKey = new Map<string, Row[]>();
    for (const row of visible) {
      const key = groupBy(row);
      let list = byKey.get(key);
      if (!list) {
        list = [];
        byKey.set(key, list);
        groups.push({ key, rows: list });
      }
      list.push(row);
    }
  } else groups.push({ key: '', rows: [...visible] });

  const renderCell = (column: DataColumn<Row>, row: Row) => {
    if (column.render) return column.render(row);
    const value = rawValue(column, row);
    const view = column.view ?? {};
    return <Value {...view} value={value} href={column.href?.(row)} />;
  };

  const renderRow = (row: Row) => {
    const rid = rowId(row);
    const checked = selected.has(rid);
    return (
      <tr
        key={rid}
        className={cx('ak-dtable-row', checked && 'ak-dtable-row-selected', onRowOpen && 'ak-dtable-row-open')}
        data-testid={id('row')}
        data-row-id={rid}
        aria-selected={selectable ? checked : undefined}
        onClick={
          onRowOpen
            ? (event) => {
                // Clicks on the row's own controls are theirs.
                if ((event.target as HTMLElement).closest('button, a, input, select, textarea, label, [role="menu"]')) return;
                onRowOpen(row);
              }
            : undefined
        }
      >
        {selectable && (
          <td className="ak-dtable-select">
            <SelectBox
              label={`Select row ${rid}`}
              checked={checked}
              onChange={(on) => {
                const next = new Set(selected);
                if (on) next.add(rid);
                else next.delete(rid);
                setSelected(next);
              }}
            />
          </td>
        )}
        {columns.map((column) => (
          <td
            key={column.key}
            className={cx(isNumeric(column) && 'ak-right ak-num', column.wrap && 'ak-wrap', column.primary && 'ak-primary-cell ak-dtable-primary')}
            data-label={labelOf(column)}
            data-testid={id(column.key)}
          >
            {column.primary && onRowOpen ? (
              <button type="button" className="ak-link-btn" onClick={() => onRowOpen(row)}>
                {renderCell(column, row)}
              </button>
            ) : (
              renderCell(column, row)
            )}
          </td>
        ))}
        {rowActions && (
          <td className="ak-right ak-dtable-actions">
            {(() => {
              const actions = rowActions(row);
              return actions.length ? <ActionMenu actions={actions} label={`Actions for ${rid}`} itemTestIdPrefix={id('action')} /> : null;
            })()}
          </td>
        )}
      </tr>
    );
  };

  let body: ReactNode;
  if (loading) {
    body = (
      <tbody data-testid={id('loading')} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <tr key={i} className="ak-dtable-skel">
            <td colSpan={colCount}>
              <Skeleton />
            </td>
          </tr>
        ))}
      </tbody>
    );
  } else if (has(error)) {
    body = (
      <tbody>
        <tr className="ak-empty-row ak-dtable-state">
          <td colSpan={colCount}>
            <Alert tone="danger" role="alert" data-testid={id('error')}>
              <span>{error}</span>
              {onRetry && (
                <Button size="sm" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </Alert>
          </td>
        </tr>
      </tbody>
    );
  } else if (visible.length === 0) {
    body = (
      <tbody>
        <tr className="ak-empty-row ak-dtable-state">
          <td colSpan={colCount} data-testid={id('empty')}>
            {empty ?? <EmptyState title="Nothing here yet" />}
          </td>
        </tr>
      </tbody>
    );
  } else {
    body = groups.map((group) => (
      <tbody key={group.key || '_'}>
        {groupBy && (
          <tr className="ak-dtable-group">
            <th colSpan={colCount} scope="colgroup">
              <span>{groupLabel ? groupLabel(group.key, group.rows) : group.key}</span>
              <span className="ak-dtable-group-count">{group.rows.length}</span>
            </th>
          </tr>
        )}
        {group.rows.map(renderRow)}
      </tbody>
    ));
  }

  const showBar = selected.size > 0 || has(toolbar) || csv;
  const first = count === 0 ? 0 : (current - 1) * pageSize + 1;
  const last = Math.min(count, current * pageSize);

  return (
    <section className={cx(cardClass, 'ak-dtable', className)} data-testid={testId} aria-label={label}>
      {showBar && (
        <div className="ak-dtable-bar">
          {selectable && selected.size > 0 ? (
            <div className="ak-dtable-bulk" role="group" aria-label="Selected rows" data-testid={id('bulk')}>
              <span className="ak-dtable-bulk-count" aria-live="polite">
                {selected.size} selected
              </span>
              {bulkActions?.({ ids: [...selected], rows: selectedRows }, clear)}
              <Button variant="ghost" size="sm" onClick={clear}>
                Clear
              </Button>
            </div>
          ) : (
            <div className="ak-dtable-tools">{toolbar}</div>
          )}
          {csv && (
            <>
              <Button size="sm" className="ak-dtable-export" disabled={exporting || loading} onClick={exportCsv} data-testid={id('action.export')}>
                Export CSV
              </Button>
              {exportError && (
                <Alert tone="danger" role="alert" data-testid={id('export.error')}>
                  The export failed. Try again.
                </Alert>
              )}
            </>
          )}
        </div>
      )}
      <div className="ak-table-wrap">
        <table className="ak-table ak-dtable-table" aria-label={label}>
          <thead>
            <tr>
              {selectable && (
                <th className="ak-dtable-select">
                  <SelectBox
                    label="Select all rows on this page"
                    checked={visibleIds.length > 0 && pickedOnPage === visibleIds.length}
                    indeterminate={pickedOnPage > 0 && pickedOnPage < visibleIds.length}
                    onChange={(on) => {
                      const next = new Set(selected);
                      for (const rid of visibleIds) {
                        if (on) next.add(rid);
                        else next.delete(rid);
                      }
                      setSelected(next);
                    }}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cx(isNumeric(column) && 'ak-right')}>
                  {column.header}
                </th>
              ))}
              {rowActions && (
                <th className="ak-dtable-actions">
                  <span className="ak-sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          {body}
        </table>
      </div>
      {pages > 1 && (
        <nav className="ak-card-foot ak-dtable-pager" aria-label={`${label} pages`} data-testid={id('pager')}>
          <span className="ak-num">
            {first}–{last} of {count}
          </span>
          <span className="ak-dtable-pager-gap" />
          <Button size="sm" disabled={current <= 1} onClick={() => goTo(current - 1)}>
            Previous
          </Button>
          <span className="ak-num" aria-current="page">
            Page {current} of {pages}
          </span>
          <Button size="sm" disabled={current >= pages} onClick={() => goTo(current + 1)}>
            Next
          </Button>
        </nav>
      )}
    </section>
  );
}
