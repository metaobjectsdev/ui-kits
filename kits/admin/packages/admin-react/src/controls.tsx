import {
  Fragment,
  cloneElement,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { cx, has } from './cx.js';

// ─── Buttons ─────────────────────────────────────────────

/**
 * `quiet` and `quietDanger` are borderless, for add and delete actions inside lists.
 * `dangerSolid` is the confirm button of a destructive dialog.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid' | 'quiet' | 'quietDanger';
export type ButtonSize = 'sm' | 'md';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'ak-btn-primary',
  secondary: '',
  ghost: 'ak-btn-ghost',
  danger: 'ak-btn-danger',
  dangerSolid: 'ak-btn-danger-solid',
  quiet: 'ak-btn-quiet',
  quietDanger: 'ak-btn-quiet-danger',
};

/** Class for a button, or a link that looks like one. */
export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md'): string {
  return cx('ak-btn', BUTTON_VARIANTS[variant], size === 'sm' && 'ak-btn-sm');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A square button holding only an icon. Give it an aria-label. */
  icon?: boolean;
}

export function Button({ variant, size, icon = false, className, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cx(buttonClass(variant, size), icon && 'ak-btn-icon', className)} {...props} />;
}

// ─── Inputs ──────────────────────────────────────────────

/** Text inputs. */
export const inputClass = 'ak-input';
/** Selects. */
export const selectClass = 'ak-select';
/** Multi-line text. */
export const textareaClass = 'ak-textarea';

/** The props Field puts on its control so the label, hint and error text are bound to it. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  required?: true;
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** An error message. It marks the control aria-invalid and is announced with it. */
  error?: ReactNode;
  required?: boolean;
  /** The control's id. Defaults to the child's own id, or a generated one. */
  id?: string;
  className?: string;
  /**
   * One control element (input, select, textarea, or a component that passes `id` and the
   * aria props through to one), or a function that receives those props to place itself.
   */
  children: ReactNode | ((control: FieldControlProps) => ReactNode);
}

function joinIds(...ids: Array<string | undefined>): string | undefined {
  return cx(...ids) || undefined;
}

/**
 * A label above a control, with an optional hint and error below it. The label is bound
 * to the control (htmlFor/id) and the hint and error are bound by aria-describedby.
 */
export function Field({ label, hint, error, required = false, id, className, children }: FieldProps) {
  const autoId = useId();
  const only = isValidElement(children) && children.type !== Fragment ? (children as ReactElement<Record<string, unknown>>) : null;
  const prop = (name: string) => {
    const value = only?.props[name];
    return typeof value === 'string' ? value : undefined;
  };
  const controlId = id ?? prop('id') ?? autoId;
  const hintId = has(hint) ? `${controlId}-hint` : undefined;
  const errorId = has(error) ? `${controlId}-error` : undefined;

  const controlProps: FieldControlProps = { id: controlId };
  const describedBy = joinIds(prop('aria-describedby'), hintId, errorId);
  if (describedBy) controlProps['aria-describedby'] = describedBy;
  if (has(error)) controlProps['aria-invalid'] = true;
  if (required) controlProps.required = true;

  let control: ReactNode;
  if (typeof children === 'function') control = children(controlProps);
  else if (only) control = cloneElement(only, { ...controlProps });
  else control = children;

  return (
    <div className={cx('ak-field', className)}>
      <label className="ak-label" htmlFor={controlId}>
        {label}
        {required && (
          <span className="ak-req" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {control}
      {has(hint) && (
        <div className="ak-hint" id={hintId}>
          {hint}
        </div>
      )}
      {has(error) && (
        <div className="ak-error-text" id={errorId}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Segmented control ───────────────────────────────────

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Styles the option as destructive when it is selected. */
  danger?: boolean;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /** Accessible name of the group. */
  label: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'data-testid'?: string;
}

/** A small set of mutually exclusive choices, shown as one row of toggle buttons. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className, 'data-testid': testId }: SegmentedControlProps<T>) {
  return (
    <div className={cx('ak-seg', className)} role="group" aria-label={label} data-testid={testId}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.danger ? 'ak-seg-danger' : undefined}
          aria-pressed={option.value === value}
          disabled={option.disabled}
          data-value={option.value}
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
