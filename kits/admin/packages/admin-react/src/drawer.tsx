import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from './controls.js';
import { cx, has } from './cx.js';
import { CloseIcon } from './icons.js';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** The elements Tab reaches inside a container, in order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest('[inert]') && el.getAttribute('aria-hidden') !== 'true');
}

/**
 * Keeps Tab and Shift+Tab inside `root`: from the last element Tab wraps to the first, and
 * back. showModal() makes the page inert, but Tab can still leave for the browser's own UI;
 * this keeps it in the dialog.
 */
export function trapTab(event: KeyboardEvent<HTMLElement>, root: HTMLElement): void {
  if (event.key !== 'Tab') return;
  const items = focusableWithin(root);
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !root.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !root.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

export interface DrawerProps {
  open: boolean;
  /** Called for the close button, Esc and a click on the backdrop. */
  onClose: () => void;
  title: ReactNode;
  /** A line under the title, such as the record's status. */
  description?: ReactNode;
  children: ReactNode;
  /** Buttons pinned to the bottom, such as Save and Cancel for a form. */
  footer?: ReactNode;
  /** While true, Esc, the backdrop and the close button do nothing (a save is running). */
  busy?: boolean;
  closeLabel?: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * A side sheet for a record's detail or a form, on the native <dialog> opened with
 * showModal(): the page behind is inert. Tab is trapped inside, Esc closes, and focus
 * returns to whatever opened it. 480px wide at the right edge from 640px up
 * (`--drawer-w`), full screen on a phone.
 */
export function Drawer({ open, onClose, title, description, children, footer, busy = false, closeLabel = 'Close', className, 'data-testid': testId }: DrawerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();
  const descId = useId();
  const latest = useRef({ open, busy, onClose });
  latest.current = { open, busy, onClose };
  const closingItself = useRef(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      opener.current = document.activeElement;
      node.showModal();
      // Start on the first field when the drawer holds a form, otherwise on Close.
      const field = node.querySelector<HTMLElement>('.ak-drawer-body :is(input, select, textarea):not([disabled])');
      (field ?? closeButton.current)?.focus();
    } else if (!open && node.open) {
      closingItself.current = true;
      node.close();
      const back = opener.current;
      opener.current = null;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    }
  }, [open]);

  const requestClose = () => {
    if (!latest.current.busy) latest.current.onClose();
  };

  return (
    <dialog
      ref={dialog}
      className={cx('ak-drawer', className)}
      aria-labelledby={titleId}
      aria-describedby={has(description) ? descId : undefined}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={(event) => {
        if (closingItself.current) {
          closingItself.current = false;
          return;
        }
        if (!latest.current.open) return;
        if (latest.current.busy) event.currentTarget.showModal();
        else latest.current.onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      onKeyDown={(event) => {
        if (dialog.current) trapTab(event, dialog.current);
      }}
    >
      <div className="ak-drawer-panel">
        <div className="ak-drawer-head">
          <div className="ak-drawer-heading">
            <h2 className="ak-drawer-title" id={titleId}>
              {title}
            </h2>
            {has(description) && (
              <p className="ak-drawer-desc" id={descId}>
                {description}
              </p>
            )}
          </div>
          <Button ref={closeButton} variant="ghost" size="sm" icon aria-label={closeLabel} disabled={busy} onClick={requestClose}>
            <CloseIcon />
          </Button>
        </div>
        <div className="ak-drawer-body">{open ? children : null}</div>
        {has(footer) && open && <div className="ak-drawer-foot">{footer}</div>}
      </div>
    </dialog>
  );
}
