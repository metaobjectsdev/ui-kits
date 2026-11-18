import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Button, Drawer } from '../src/index.js';

function Harness({ busy = false, onClose = () => {}, withForm = false }: { busy?: boolean; onClose?: () => void; withForm?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open lead
      </button>
      <Drawer
        open={open}
        busy={busy}
        title="A. Example"
        description="Talking · follow up 2026-11-18"
        data-testid="sales-leads.drawer"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        footer={
          <>
            <Button>Cancel</Button>
            <Button variant="primary">Save</Button>
          </>
        }
      >
        {withForm ? <input aria-label="Note" /> : <p>Fields go here.</p>}
      </Drawer>
    </>
  );
}

const drawer = () => document.querySelector('dialog.ak-drawer') as HTMLDialogElement;

describe('Drawer', () => {
  it('opens as a modal dialog named by its title, focus on Close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(drawer().open).toBe(false);
    expect(screen.queryByText('Fields go here.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open lead' }));
    const dialog = screen.getByRole('dialog', { name: 'A. Example' }) as HTMLDialogElement;
    expect(dialog).toBe(drawer());
    expect(dialog.open).toBe(true);
    expect(dialog).toHaveAccessibleDescription('Talking · follow up 2026-11-18');
    expect(dialog).toHaveAttribute('data-testid', 'sales-leads.drawer');
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('starts on the first field when it holds a form', async () => {
    const user = userEvent.setup();
    render(<Harness withForm />);
    await user.click(screen.getByRole('button', { name: 'Open lead' }));
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus();
  });

  it('closes on Esc and returns focus to the opener', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open lead' });
    await user.click(opener);
    // Esc on a modal dialog fires `cancel`.
    const cancel = new Event('cancel', { cancelable: true });
    act(() => {
      drawer().dispatchEvent(cancel);
    });
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(drawer().open).toBe(false);
    expect(opener).toHaveFocus();
  });

  it('closes from the Close button and the backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open lead' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Open lead' }));
    fireEvent.click(drawer());
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('traps Tab inside: forward from the last control wraps to the first, and back', async () => {
    const user = userEvent.setup();
    render(<Harness withForm />);
    await user.click(screen.getByRole('button', { name: 'Open lead' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(save).toHaveFocus();
    // Tab never reaches the page behind.
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(drawer().contains(document.activeElement)).toBe(true);
    }
  });

  it('ignores Esc, backdrop and Close while busy', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Open lead' }));
    rerender(<Harness onClose={onClose} busy />);
    act(() => {
      drawer().dispatchEvent(new Event('cancel', { cancelable: true }));
    });
    fireEvent.click(drawer());
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    expect(drawer().open).toBe(true);
  });
});
