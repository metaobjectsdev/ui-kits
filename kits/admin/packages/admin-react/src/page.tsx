import type { ReactNode } from 'react';
import { cx, has } from './cx.js';

/** The title row every admin page starts with. */
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** A link back to the parent page, shown above the title. */
  back?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, back, actions }: PageHeaderProps) {
  return (
    <header className="ak-page-head">
      <div>
        {has(back) && <div className="ak-page-back">{back}</div>}
        <h1 className="ak-page-title">{title}</h1>
        {has(description) && <p className="ak-page-desc">{description}</p>}
      </div>
      {has(actions) && <div className="ak-actions">{actions}</div>}
    </header>
  );
}

/** A titled block of a page, not boxed. */
export interface SectionProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Section({ title, description, actions, children }: SectionProps) {
  return (
    <section className="ak-section">
      <div className="ak-section-head">
        <div>
          <h2 className="ak-section-title">{title}</h2>
          {has(description) && <p className="ak-section-desc">{description}</p>}
        </div>
        {has(actions) && <div className="ak-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Class for a boxed panel, for markup that needs the card look without the Card component. */
export const cardClass = 'ak-card';

/** A boxed panel, optionally with a title bar and a footer. */
export interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** false drops the body padding, for a table or list that runs edge to edge. */
  padded?: boolean;
  className?: string;
}

export function Card({ title, actions, footer, children, padded = true, className }: CardProps) {
  return (
    <section className={cx(cardClass, className)}>
      {(has(title) || has(actions)) && (
        <div className="ak-card-head">
          {has(title) && <h2 className="ak-card-title">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={padded ? 'ak-card-body' : undefined}>{children}</div>
      {has(footer) && <div className="ak-card-foot">{footer}</div>}
    </section>
  );
}

/** A row of stat cards: two across on phones, `cols` across on wide screens. */
export interface StatGridProps {
  cols?: 3 | 4 | 5;
  children: ReactNode;
}

export function StatGrid({ cols = 3, children }: StatGridProps) {
  return <div className={`ak-stats ak-stats-cols-${cols}`}>{children}</div>;
}

/** One number with its label. `small` is for a value that is text rather than a figure. */
export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  small?: boolean;
}

export function StatCard({ label, value, note, small = false }: StatCardProps) {
  return (
    <div className={cx(cardClass, 'ak-stat')}>
      <p className="ak-stat-label">{label}</p>
      <p className={cx('ak-stat-value', small && 'ak-stat-value-sm')}>{value}</p>
      {has(note) && <p className="ak-stat-note">{note}</p>}
    </div>
  );
}
