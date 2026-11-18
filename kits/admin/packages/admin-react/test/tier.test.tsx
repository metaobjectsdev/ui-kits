// Proofs of the tier-derived confirmation rule: T0 and T1 run at once, T2 asks naming who
// the action reaches, T3 asks and needs a second factor unless the owner recorded an
// exception on the operation. A page cannot weaken it.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog, confirmationFor, useTieredConfirm, type TieredAnswer, type TieredConfirmOptions } from '../src/index.js';

function Asker({ options, onAnswer }: { options: TieredConfirmOptions; onAnswer: (answer: TieredAnswer | null) => void }) {
  const [ask, dialog] = useTieredConfirm();
  return (
    <>
      <button type="button" onClick={async () => onAnswer(await ask(options))}>
        Act
      </button>
      {dialog}
    </>
  );
}

const dialogOpen = () => (document.querySelector('dialog.ak-dialog') as HTMLDialogElement).open;

describe('confirmationFor', () => {
  it('derives the confirmation from the tier alone', () => {
    expect(confirmationFor(0)).toBe('none');
    expect(confirmationFor(1)).toBe('none');
    expect(confirmationFor(2)).toBe('confirm');
    expect(confirmationFor(3)).toBe('second-factor');
    expect(confirmationFor(3, { exception: true })).toBe('confirm');
    // An exception never lowers T2 to nothing.
    expect(confirmationFor(2, { exception: true })).toBe('confirm');
  });
});

describe('useTieredConfirm', () => {
  it.each([0, 1] as const)('T%s runs at once, with no dialog', async (tier) => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Asker options={{ tier, title: 'Mark done?' }} onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Act' }));
    expect(onAnswer).toHaveBeenCalledWith({});
    expect(dialogOpen()).toBe(false);
  });

  it('T2 asks, naming who the action reaches', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Asker options={{ tier: 2, title: 'Send the reply?', reaches: 'A. Example (a person)', confirmLabel: 'Send' }} onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Act' }));
    const dialog = screen.getByRole('dialog', { name: 'Send the reply?' });
    expect(dialog).toHaveAttribute('data-tier', '2');
    expect(dialog).toHaveTextContent('Reaches A. Example (a person)');
    expect(screen.queryByLabelText('Second factor code')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onAnswer).toHaveBeenCalledWith({});
  });

  it('T3 needs a second factor before it confirms, and hands it back', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Asker options={{ tier: 3, title: 'Delete 412 messages?', reaches: 'your mailbox', confirmLabel: 'Delete' }} onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Act' }));
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Second factor code'), '   ');
    expect(confirm).toBeDisabled();
    await user.clear(screen.getByLabelText('Second factor code'));
    await user.type(screen.getByLabelText('Second factor code'), '482913');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onAnswer).toHaveBeenCalledWith({ secondFactor: '482913' });
  });

  it('T3 with the owner recorded exception confirms like T2', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Asker options={{ tier: 3, exception: true, title: 'Clean up?', confirmLabel: 'Clean up' }} onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Act' }));
    expect(screen.queryByLabelText('Second factor code')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clean up' }));
    expect(onAnswer).toHaveBeenCalledWith({});
  });

  it('cancelling resolves null', async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<Asker options={{ tier: 3, title: 'Delete?' }} onAnswer={onAnswer} />);
    await user.click(screen.getByRole('button', { name: 'Act' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAnswer).toHaveBeenCalledWith(null);
  });
});

describe('ConfirmDialog with a tier cannot be weakened by the page', () => {
  function Open({ tone }: { tone: 'primary' | 'danger' }) {
    const [open] = useState(true);
    return <ConfirmDialog open={open} tier={3} tone={tone} title="Go?" confirmLabel="Go" onConfirm={() => {}} onCancel={() => {}} />;
  }

  it('keeps T3 a danger confirmation behind a second factor, whatever tone is passed', () => {
    render(<Open tone="primary" />);
    const go = screen.getByRole('button', { name: 'Go' });
    expect(go).toHaveClass('ak-btn-danger-solid');
    expect(go).toBeDisabled();
    expect(screen.getByLabelText('Second factor code')).toBeInTheDocument();
  });

  it('submits the second factor on Enter', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open tier={3} title="Go?" onConfirm={onConfirm} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('Second factor code'), '1234{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('1234');
  });

  it('without a tier, behaves as before (plain confirm, no code)', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Archive?" tone="primary" confirmLabel="Archive" onConfirm={onConfirm} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Archive' })).toHaveClass('ak-btn-primary');
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    expect(onConfirm).toHaveBeenCalledWith();
  });
});
