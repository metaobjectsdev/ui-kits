import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, inputClass } from './controls.js';
import { has } from './cx.js';

/**
 * An action's tier, which alone decides how hard it is to confirm:
 * T0 and T1 run at once; T2 asks, naming who the action reaches; T3 asks and needs a second
 * factor. A page cannot weaken this; the only exception is one the owner recorded on the
 * operation itself, which lowers T3 to T2.
 */
export type ActionTier = 0 | 1 | 2 | 3;

export type Confirmation = 'none' | 'confirm' | 'second-factor';

/** The confirmation an action of `tier` needs. `exception` is the owner's recorded exception for T3. */
export function confirmationFor(tier: ActionTier, { exception = false }: { exception?: boolean } = {}): Confirmation {
  if (tier <= 1) return 'none';
  if (tier === 2 || exception) return 'confirm';
  return 'second-factor';
}

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  /** What will happen, and whether it can be undone. */
  children?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  /** `danger` (the default) for a destructive action; `primary` for anything else. A tier of 2 or more is always `danger`. */
  tone?: 'danger' | 'primary';
  /**
   * The action's tier. With a tier, the dialog's strength comes from it: at T3 the confirm
   * button stays disabled until a second factor is entered, and onConfirm receives it.
   */
  tier?: ActionTier;
  /** The owner's recorded exception on the operation: a T3 action confirms like T2. */
  exception?: boolean;
  /** Who or what the action reaches (a person, a list, the public), shown above the buttons. */
  reaches?: ReactNode;
  /** Label of the second-factor field at T3. */
  secondFactorLabel?: ReactNode;
  /** Disables both buttons and ignores Esc while the action runs. */
  busy?: boolean;
  /** Called with the second factor at T3, and with nothing otherwise. */
  onConfirm: (secondFactor?: string) => void;
  /** Called for the Cancel button, Esc, and a click on the backdrop. */
  onCancel: () => void;
}

/**
 * A confirmation on the native <dialog> element, opened with showModal(): the browser
 * traps focus, makes the page behind it inert and handles Esc. Focus starts on Cancel,
 * so a stray Enter never confirms a destructive action.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  tier,
  exception = false,
  reaches,
  secondFactorLabel = 'Second factor code',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const codeId = useId();
  const [code, setCode] = useState('');
  const needsCode = tier != null && confirmationFor(tier, { exception }) === 'second-factor';
  const danger = tone === 'danger' || (tier != null && tier >= 2);
  // The close event arrives after a render; these say what is current when it does.
  const latest = useRef({ open, busy, onCancel });
  latest.current = { open, busy, onCancel };
  // Set while this component closes the dialog itself, so the close event that follows
  // (queued by the browser, possibly after a new confirm has reopened it) is not a cancel.
  const closingItself = useRef(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      setCode('');
      node.showModal();
      cancelButton.current?.focus();
    } else if (!open && node.open) {
      closingItself.current = true;
      node.close();
    }
  }, [open]);

  const cancel = () => {
    if (!latest.current.busy) latest.current.onCancel();
  };

  return (
    <dialog
      ref={dialog}
      className="ak-dialog"
      data-tier={tier}
      aria-labelledby={titleId}
      aria-describedby={has(children) ? bodyId : undefined}
      onCancel={(event) => {
        // Esc: keep the dialog's state owned by `open`, and report the cancel instead.
        event.preventDefault();
        cancel();
      }}
      onClose={(event) => {
        if (closingItself.current) {
          closingItself.current = false;
          return;
        }
        // Closed by the browser despite preventDefault (Chrome does so on a repeated Esc).
        if (!latest.current.open) return;
        if (latest.current.busy) event.currentTarget.showModal();
        else latest.current.onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div className="ak-dialog-head">
        <h2 className="ak-dialog-title" id={titleId}>
          {title}
        </h2>
      </div>
      <div className="ak-dialog-body" id={bodyId}>
        {children}
        {has(reaches) && (
          <p className="ak-dialog-reaches">
            <span className="ak-dialog-reaches-label">Reaches</span> {reaches}
          </p>
        )}
      </div>
      {needsCode && (
        <div className="ak-dialog-factor">
          <label className="ak-label" htmlFor={codeId}>
            {secondFactorLabel}
          </label>
          <input
            id={codeId}
            className={inputClass}
            autoComplete="one-time-code"
            inputMode="numeric"
            value={code}
            disabled={busy}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && code.trim() && !busy) {
                event.preventDefault();
                onConfirm(code.trim());
              }
            }}
          />
        </div>
      )}
      <div className="ak-dialog-foot">
        <Button ref={cancelButton} disabled={busy} onClick={cancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'dangerSolid' : 'primary'}
          disabled={busy || (needsCode && !code.trim())}
          onClick={() => (needsCode ? onConfirm(code.trim()) : onConfirm())}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

export type ConfirmOptions = Pick<ConfirmDialogProps, 'title' | 'confirmLabel' | 'cancelLabel' | 'tone'> & {
  message?: ReactNode;
};

type Pending = ConfirmOptions & { resolve: (answer: boolean) => void };

/**
 * A promise-based replacement for window.confirm. Render the returned element once;
 * `await confirm({...})` resolves true on Confirm and false on Cancel, Esc or the backdrop.
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (!(await confirm({ title: 'Revoke access?', confirmLabel: 'Revoke' }))) return;
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null);
  // The open request, outside React state so it can be settled without a render.
  const current = useRef<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A new request replaces an open one, which counts as cancelled.
        current.current?.resolve(false);
        current.current = { ...options, resolve };
        setPending(current.current);
      }),
    [],
  );

  const settle = (answer: boolean) => {
    const request = current.current;
    current.current = null;
    request?.resolve(answer);
    setPending(null);
  };

  // Unmounting with a question open answers it with false, so no caller waits forever.
  useEffect(
    () => () => {
      current.current?.resolve(false);
      current.current = null;
    },
    [],
  );

  const element = (
    <ConfirmDialog
      open={pending != null}
      title={pending?.title ?? ''}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    >
      {pending?.message}
    </ConfirmDialog>
  );

  return [confirm, element];
}

export type TieredConfirmOptions = Pick<ConfirmDialogProps, 'title' | 'confirmLabel' | 'cancelLabel' | 'reaches' | 'secondFactorLabel' | 'exception'> & {
  tier: ActionTier;
  message?: ReactNode;
};

/** A confirmed action. `secondFactor` is set when the tier needed one. */
export interface TieredAnswer {
  secondFactor?: string;
}

type TieredPending = TieredConfirmOptions & { resolve: (answer: TieredAnswer | null) => void };

/**
 * Asks for the confirmation an action's tier needs, and no other. T0 and T1 resolve at once
 * without a dialog; T2 asks; T3 asks for a second factor too. Resolves null when cancelled.
 *
 *   const [ask, dialog] = useTieredConfirm();
 *   const answer = await ask({ tier: 3, title: 'Send to the list?', reaches: '2,140 subscribers' });
 *   if (answer) await send({ secondFactor: answer.secondFactor });
 */
export function useTieredConfirm(): [(options: TieredConfirmOptions) => Promise<TieredAnswer | null>, ReactNode] {
  const [pending, setPending] = useState<TieredPending | null>(null);
  const current = useRef<TieredPending | null>(null);

  const ask = useCallback((options: TieredConfirmOptions) => {
    if (confirmationFor(options.tier, options) === 'none') return Promise.resolve<TieredAnswer | null>({});
    return new Promise<TieredAnswer | null>((resolve) => {
      current.current?.resolve(null);
      current.current = { ...options, resolve };
      setPending(current.current);
    });
  }, []);

  const settle = (answer: TieredAnswer | null) => {
    const request = current.current;
    current.current = null;
    request?.resolve(answer);
    setPending(null);
  };

  useEffect(
    () => () => {
      current.current?.resolve(null);
      current.current = null;
    },
    [],
  );

  const element = (
    <ConfirmDialog
      open={pending != null}
      title={pending?.title ?? ''}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      tier={pending?.tier ?? 2}
      exception={pending?.exception}
      reaches={pending?.reaches}
      secondFactorLabel={pending?.secondFactorLabel}
      onConfirm={(secondFactor) => settle(secondFactor ? { secondFactor } : {})}
      onCancel={() => settle(null)}
    >
      {pending?.message}
    </ConfirmDialog>
  );

  return [ask, element];
}
