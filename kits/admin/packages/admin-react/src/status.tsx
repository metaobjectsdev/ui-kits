import type { CSSProperties, ReactNode } from 'react';
import { cx, has } from './cx.js';
import { CheckIcon, InboxIcon } from './icons.js';

// ─── Badges ──────────────────────────────────────────────

/** `neutral` is the default grey badge; `plain` drops the dot; `realm` is an outlined marker. */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'plain' | 'realm';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: '',
  success: 'ak-badge-success',
  warning: 'ak-badge-warning',
  danger: 'ak-badge-danger',
  info: 'ak-badge-info',
  accent: 'ak-badge-accent',
  plain: 'ak-badge-plain',
  realm: 'ak-badge-realm',
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/** A status word with a coloured dot. Always give it text: colour alone never carries meaning. */
export function Badge({ tone = 'neutral', children, className, 'data-testid': testId }: BadgeProps) {
  return (
    <span className={cx('ak-badge', BADGE_TONES[tone], className)} data-testid={testId}>
      {children}
    </span>
  );
}

// ─── Alerts ──────────────────────────────────────────────

export type AlertTone = 'danger' | 'warning' | 'info' | 'success';

export interface AlertProps {
  tone?: AlertTone;
  role?: 'alert' | 'status';
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/** A message box. Pass `role="alert"` only for a message that should interrupt. */
export function Alert({ tone = 'info', role, children, className, 'data-testid': testId }: AlertProps) {
  return (
    <div role={role} className={cx('ak-alert', `ak-alert-${tone}`, className)} data-testid={testId}>
      {children}
    </div>
  );
}

export interface ErrorTextProps {
  children: ReactNode;
  role?: 'alert';
}

/** An error message. Pass `role="alert"` only where the page already announced it. */
export function ErrorText({ children, role }: ErrorTextProps) {
  return (
    <p role={role} className="ak-alert ak-alert-danger">
      {children}
    </p>
  );
}

// ─── Loading ─────────────────────────────────────────────

export interface LoadingProps {
  label?: string;
}

/** A page or panel that is still loading. */
export function Loading({ label = 'Loading…' }: LoadingProps) {
  return (
    <p className="ak-loading" role="status">
      {label}
    </p>
  );
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  lines?: number;
  className?: string;
}

/**
 * A placeholder bar shaped like the content that is loading. Its shimmer stops under
 * prefers-reduced-motion. `lines` stacks several bars, the last one shorter.
 */
export function Skeleton({ width, height, lines = 1, className }: SkeletonProps) {
  const size = (withWidth: boolean): CSSProperties | undefined => {
    const style: CSSProperties = {};
    if (withWidth && width != null) style.width = width;
    if (height != null) style.height = height;
    return Object.keys(style).length ? style : undefined;
  };
  if (lines <= 1) return <span className={cx('ak-skel', className)} style={size(true)} aria-hidden="true" />;
  return (
    <span className={cx('ak-skel-stack', className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="ak-skel" style={size(i < lines - 1)} />
      ))}
    </span>
  );
}

// ─── Empty states ────────────────────────────────────────

/**
 * Two kinds of empty, so a reader can tell them apart at a glance:
 * - `no-data`: nothing here yet, or nothing matches the filter.
 * - `all-clear`: empty because everything is handled. Calm, with a check mark.
 */
export type EmptyKind = 'no-data' | 'all-clear';

export interface EmptyStateProps {
  kind?: EmptyKind;
  /** A short headline. */
  title?: ReactNode;
  /** The explanation. With no title, it is the only text. */
  children?: ReactNode;
  /** A next step, such as a button that clears the filter. */
  action?: ReactNode;
  /** Replaces the default icon for the kind. */
  icon?: ReactNode;
}

export function EmptyState({ kind = 'no-data', title, children, action, icon }: EmptyStateProps) {
  return (
    <div className={cx('ak-empty', kind === 'all-clear' && 'ak-empty-calm')} data-kind={kind}>
      <div className="ak-empty-icon">{icon ?? (kind === 'all-clear' ? <CheckIcon /> : <InboxIcon />)}</div>
      {has(title) && <p className="ak-empty-title">{title}</p>}
      {has(children) && <div className="ak-empty-text">{children}</div>}
      {has(action) && <div className="ak-empty-action">{action}</div>}
    </div>
  );
}
