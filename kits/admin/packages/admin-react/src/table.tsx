import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cardClass } from './page.js';
import { cx } from './cx.js';

/** A boxed table that scrolls sideways inside its card on narrow screens, never the page. */
export interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={cx(cardClass, 'ak-table-wrap', className)}>
      <table className="ak-table">{children}</table>
    </div>
  );
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'right';
}

/** A column header cell. `align="right"` pairs with a `Td` that has `num`. */
export function Th({ align = 'left', className, ...props }: ThProps) {
  return <th className={cx(align === 'right' && 'ak-right', className)} {...props} />;
}

/** A table cell. `num` right-aligns it with even-width digits; `wrap` lets long text wrap. */
export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  num?: boolean;
  wrap?: boolean;
}

export function Td({ num = false, wrap = false, className, ...props }: TdProps) {
  return <td className={cx(num && 'ak-right ak-num', wrap && 'ak-wrap', className)} {...props} />;
}

/** Class for a body row. Rows inside a Table are styled without it; it keeps markup portable. */
export const trClass = 'ak-tr';

/** One full-width row for an empty table body. */
export interface EmptyRowProps {
  /** The number of columns the row spans. */
  cols: number;
  children: ReactNode;
}

export function EmptyRow({ cols, children }: EmptyRowProps) {
  return (
    <tr className="ak-empty-row">
      <td colSpan={cols}>{children}</td>
    </tr>
  );
}

/**
 * Class names for a generated MetaObjects EntityGrid, which takes class names rather than
 * components. Spread them onto the grid and wrap it in a card that scrolls:
 *
 *   <div className="ak-card ak-table-wrap"><EntityGrid {...entityGridClasses} … /></div>
 */
export const entityGridClasses = {
  className: 'ak-table',
  headerClassName: 'ak-grid-head',
  rowClassName: trClass,
  cellClassName: 'ak-grid-cell',
  searchClassName: 'ak-grid-search',
  paginationClassName: 'ak-grid-pager',
} as const;
