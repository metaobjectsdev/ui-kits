import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from './controls.js';
import { cx } from './cx.js';
import { MoreIcon } from './icons.js';

export interface MenuAction {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  /** `danger` for a destructive action. */
  tone?: 'danger';
  disabled?: boolean;
}

/**
 * A "⋯" button that opens a menu of actions: the row-action menu of DataTable, usable
 * anywhere. Arrow keys, Home and End move, Enter or Space picks, Esc and Tab close, and
 * focus returns to the button. The menu is fixed to the viewport, so a scrolling table
 * never clips it. Item test ids are `<itemTestId prefix>.<action id>`.
 */
export function ActionMenu({ actions, label = 'Actions', icon, buttonLabel, itemTestIdPrefix, 'data-testid': testId }: {
  actions: ReadonlyArray<MenuAction>;
  /** Accessible name of the button. */
  label?: string;
  icon?: ReactNode;
  /** Visible text instead of the icon. */
  buttonLabel?: ReactNode;
  itemTestIdPrefix?: string;
  'data-testid'?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  // Place the menu under the button, right-aligned, or above it near the bottom edge.
  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - rect.right);
    const below = window.innerHeight - rect.bottom;
    setStyle(below < 220 && rect.top > below ? { right, bottom: window.innerHeight - rect.top + 4 } : { right, top: rect.bottom + 4 });
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open]);

  // Outside clicks, scrolling and resizing close it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: Event) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };
    const onMove = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  const move = (step: number | 'first' | 'last') => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = step === 'first' ? 0 : step === 'last' ? items.length - 1 : (at + step + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <span className="ak-menu">
      <Button
        ref={button}
        variant="ghost"
        size="sm"
        icon={buttonLabel == null}
        aria-label={buttonLabel == null ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-testid={testId}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {buttonLabel ?? icon ?? <MoreIcon />}
      </Button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          className="ak-menu-list"
          style={style}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') move(1);
            else if (event.key === 'ArrowUp') move(-1);
            else if (event.key === 'Home') move('first');
            else if (event.key === 'End') move('last');
            else if (event.key === 'Escape') close(true);
            else if (event.key === 'Tab') close(false);
            else return;
            if (event.key !== 'Tab') event.preventDefault();
            event.stopPropagation();
          }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cx('ak-menu-item', action.tone === 'danger' && 'ak-menu-item-danger')}
              disabled={action.disabled}
              data-testid={itemTestIdPrefix ? `${itemTestIdPrefix}.${action.id}` : undefined}
              onClick={() => {
                close(true);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
