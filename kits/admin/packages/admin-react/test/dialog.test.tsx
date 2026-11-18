import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog, useConfirm } from '../src/index.js';

function Harness({ onConfirm = () => {}, onCancel = () => {} }: { onConfirm?: () => void; onCancel?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Revoke
      </button>
      <ConfirmDialog
        open={open}
        title="Revoke access?"
        confirmLabel="Revoke access"
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      >
        The buyer loses the program at once.
      </ConfirmDialog>
    </>
  );
}

function dialogElement(): HTMLDialogElement {
  return document.querySelector('dialog.ak-dialog') as HTMLDialogElement;
}

describe('ConfirmDialog', () => {
  it('opens with showModal, names itself and starts focus on Cancel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(dialogElement().open).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    const dialog = screen.getByRole('dialog', { name: 'Revoke access?' });
    expect(dialog).toBe(dialogElement());
    expect(dialogElement().open).toBe(true);
    expect(dialog).toHaveAccessibleDescription('The buyer loses the program at once.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(screen.getByRole('button', { name: 'Revoke access' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(dialogElement().open).toBe(false);
  });

  it('cancels from the Cancel button', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialogElement().open).toBe(false);
  });

  it('cancels on Esc (the cancel event) without closing itself behind its owner', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    const cancelEvent = new Event('cancel', { cancelable: true });
    act(() => {
      dialogElement().dispatchEvent(cancelEvent);
    });

    // The native close is prevented; the owner's state closes it instead.
    expect(cancelEvent.defaultPrevented).toBe(true);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(dialogElement().open).toBe(false);
  });

  it('cancels on a click on the backdrop', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    fireEvent.click(dialogElement());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(dialogElement().open).toBe(false);
  });

  it('ignores Esc and disables its buttons while busy', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open busy title="Deleting" onConfirm={() => {}} onCancel={onCancel}>
        Working…
      </ConfirmDialog>,
    );
    act(() => {
      dialogElement().dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });
});

describe('useConfirm', () => {
  function Page({ onAnswer }: { onAnswer: (answer: boolean) => void }) {
    const [confirm, confirmDialog] = useConfirm();
    return (
      <>
        <button
          type="button"
          onClick={async () => onAnswer(await confirm({ title: 'Delete week 3?', message: 'Its lessons go too.', confirmLabel: 'Delete' }))}
        >
          Delete week
        </button>
        {confirmDialog}
      </>
    );
  }

  it('resolves true on confirm', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Page onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Delete week' }));
    expect(screen.getByRole('dialog', { name: 'Delete week 3?' })).toHaveAccessibleDescription('Its lessons go too.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(dialogElement().open).toBe(false);
  });

  it('resolves false on Esc', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Page onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Delete week' }));
    await act(async () => {
      dialogElement().dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(dialogElement().open).toBe(false);
  });

  it('keeps a second confirm open when the close event of the first arrives late', async () => {
    const user = userEvent.setup();
    const answers: boolean[] = [];
    function Chain() {
      const [confirm, confirmDialog] = useConfirm();
      return (
        <>
          <button
            type="button"
            onClick={async () => {
              const first = await confirm({ title: 'Archive?', confirmLabel: 'Archive' });
              answers.push(first);
              if (first) answers.push(await confirm({ title: 'Notify buyers?', confirmLabel: 'Notify' }));
            }}
          >
            Start
          </button>
          {confirmDialog}
        </>
      );
    }
    render(<Chain />);
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    // Let the queued close event of the first dialog fire.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(answers).toEqual([true]);
    expect(screen.getByRole('dialog', { name: 'Notify buyers?' })).toBeInTheDocument();
    expect(dialogElement().open).toBe(true);
  });

  it('answers false when the page unmounts with a question open', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const { unmount } = render(<Page onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Delete week' }));
    unmount();
    await act(() => Promise.resolve());
    expect(onAnswer).toHaveBeenCalledWith(false);
  });

  it('answers the first question false when a second replaces it', async () => {
    const answers: Array<[string, boolean]> = [];
    let ask: ((title: string) => void) | undefined;
    function Twice() {
      const [confirm, confirmDialog] = useConfirm();
      ask = (title) => void confirm({ title }).then((answer) => answers.push([title, answer]));
      return <>{confirmDialog}</>;
    }
    render(<Twice />);
    await act(async () => ask?.('One?'));
    await act(async () => ask?.('Two?'));
    expect(answers).toEqual([['One?', false]]);
    expect(screen.getByRole('dialog', { name: 'Two?' })).toBeInTheDocument();
  });
});
