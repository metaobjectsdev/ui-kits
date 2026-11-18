// Proofs of the inline-edit guard: a cell saves on blur, only a changed value, one save at
// a time, and never over a load that is pending or failed.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineEditCell, type LoadState } from '../src/index.js';

function cell(props: Partial<Parameters<typeof InlineEditCell>[0]> = {}) {
  return <InlineEditCell label="Note for A. Example" value="call Tue" load="ready" onSave={() => {}} data-testid="sales-leads.table.note" {...props} />;
}

describe('InlineEditCell', () => {
  it('saves a changed value on blur', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <>
        {cell({ onSave })}
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole('button', { name: /Note for A\. Example: call Tue\. Edit/ }));
    const input = screen.getByRole('textbox', { name: 'Note for A. Example' });
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, 'call Wed');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('call Wed');
  });

  it('saves on Enter, cancels on Esc, and does not save an unchanged value', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(cell({ onSave }));
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.keyboard('{Enter}');
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.keyboard(' later{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('sales-leads.table.note')).toHaveAttribute('data-state', 'idle');
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.keyboard('!{Enter}');
    expect(onSave).toHaveBeenCalledWith('call Tue!');
  });

  it.each<LoadState>(['pending', 'error'])('cannot edit or save while the load is %s', async (load) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(cell({ onSave, load }));
    const view = screen.getByRole('button', { name: /Note for A\. Example/ });
    expect(view).toBeDisabled();
    expect(screen.getByTestId('sales-leads.table.note')).toHaveAttribute('data-state', 'locked');
    await user.click(view);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each<LoadState>(['pending', 'error'])('drops an open edit without saving when the load turns %s', async (load) => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = render(cell({ onSave }));
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.type(screen.getByRole('textbox'), ' changed');
    rerender(cell({ onSave, load }));
    expect(screen.queryByRole('textbox')).toBeNull();
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not save when the browser blurs the input as Esc removes it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // Browsers fire focusout on a focused element as it leaves the page; jsdom does not, so
    // fire it as React removes the input. (React itself drops events during a commit, so this
    // also holds the line if that ever changes.)
    const remove = Node.prototype.removeChild;
    const spy = vi.spyOn(Node.prototype, 'removeChild').mockImplementation(function <T extends Node>(this: Node, child: T): T {
      if (child instanceof HTMLInputElement) child.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      return remove.call(this, child) as T;
    });
    render(cell({ onSave }));
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.type(screen.getByRole('textbox'), ' later');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('keeps the edit and shows the error when the save fails, then retries', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValueOnce(new Error('Stage is locked')).mockResolvedValueOnce(undefined);
    render(cell({ onSave }));
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.type(screen.getByRole('textbox'), '!');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Stage is locked');
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('call Tue!');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.keyboard('{Enter}');
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('puts focus back in the field after an Enter save fails and the browser dropped it', async () => {
    const user = userEvent.setup();
    let fail: (error: Error) => void = () => {};
    const onSave = vi.fn(() => new Promise<void>((_, reject) => (fail = reject)));
    render(cell({ onSave }));
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.type(screen.getByRole('textbox'), '!');
    await user.keyboard('{Enter}');
    const elsewhere = document.body.appendChild(document.createElement('button'));
    act(() => elsewhere.focus());
    await act(async () => fail(new Error('Stage is locked')));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stage is locked');
    expect(screen.getByRole('textbox')).toHaveFocus();
    elsewhere.remove();
  });

  it('runs one save at a time', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onSave = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    render(cell({ onSave }));
    await user.click(screen.getByRole('button', { name: /Edit/ }));
    await user.type(screen.getByRole('textbox'), '!');
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('sales-leads.table.note')).toHaveAttribute('data-state', 'saving');
    expect(screen.getByRole('textbox')).toBeDisabled();
    act(() => {
      screen.getByRole('textbox').dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.getByTestId('sales-leads.table.note')).toHaveAttribute('data-state', 'idle');
  });

  it('edits a select and shows "—" for an unknown value', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(cell({ value: null, onSave, type: 'select', options: [{ value: 'new', label: 'New' }, { value: 'won', label: 'Won' }] }));
    expect(screen.getByTestId('sales-leads.table.note')).toHaveTextContent('—');
    await user.click(screen.getByRole('button', { name: /unknown\. Edit/ }));
    await user.selectOptions(screen.getByRole('combobox'), 'won');
    await user.tab();
    expect(onSave).toHaveBeenCalledWith('won');
  });
});
