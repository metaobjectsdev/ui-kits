import { createContext, useCallback, useContext, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { Button } from './controls.js';
import { cx } from './cx.js';
import { CloseIcon } from './icons.js';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Shows an Undo button that calls this. */
  onUndo?: () => void;
  undoLabel?: ReactNode;
  /** Shows a dismiss button that calls this. */
  onDismiss?: () => void;
}

/** One toast as rendered. */
export function Toast({ children, onUndo, undoLabel = 'Undo', onDismiss, className, ...props }: ToastProps) {
  return (
    <div className={cx('ak-toast', className)} {...props}>
      <span className="ak-toast-message">{children}</span>
      {onUndo && (
        <Button size="sm" onClick={onUndo}>
          {undoLabel}
        </Button>
      )}
      {onDismiss && (
        <Button variant="ghost" size="sm" icon aria-label="Dismiss" onClick={onDismiss}>
          <CloseIcon />
        </Button>
      )}
    </div>
  );
}

export interface ToastOptions {
  message: ReactNode;
  /** Shows an Undo button. It runs once, then the toast closes. */
  undo?: () => void;
  undoLabel?: ReactNode;
  /**
   * How long the toast stays, in milliseconds. Default 6000; with an undo, 8000. The clock
   * stops while the pointer is over the toast or focus is inside it.
   */
  duration?: number;
}

type ShowToast = (options: ToastOptions | string) => () => void;

const ToastContext = createContext<ShowToast | null>(null);

interface Item extends ToastOptions {
  id: number;
}

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Holds the toasts for everything inside it, in a polite live region pinned to the bottom
 * of the screen. Wrap the app (or the admin shell) in it once.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (options) => {
      const item: Item = { ...(typeof options === 'string' ? { message: options } : options), id: nextId.current++ };
      setItems((current) => [...current, item]);
      return () => dismiss(item.id);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="ak-toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <TimedToast key={item.id} item={item} onDone={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function TimedToast({ item, onDone }: { item: Item; onDone: (id: number) => void }) {
  const duration = item.duration ?? (item.undo ? 8000 : 6000);
  const used = useRef(false);
  const remaining = useRef(duration);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDone(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, item.id, onDone]);

  const action = item.undo;
  const undo = action && (() => {
    if (used.current) return;
    used.current = true;
    action();
    onDone(item.id);
  });

  return (
    <Toast
      onUndo={undo}
      undoLabel={item.undoLabel}
      onDismiss={() => onDone(item.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => setFocused(event.currentTarget.contains(event.relatedTarget))}
    >
      {item.message}
    </Toast>
  );
}

/**
 * Returns `toast(message | options)`, which shows a toast and returns a function that
 * closes it early. Must be called inside a ToastProvider.
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside a <ToastProvider>.');
  return show;
}
