import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast, type ToastOptions } from '../src/index.js';

function Trigger({ options }: { options: ToastOptions | string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast(options)}>
      Show
    </button>
  );
}

function renderWith(options: ToastOptions | string) {
  return render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  );
}

describe('toasts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces the message in a polite live region', () => {
    renderWith('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Saved');
  });

  it('runs Undo once and closes the toast', () => {
    const undo = vi.fn();
    renderWith({ message: 'Purchase revoked', undo });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Purchase revoked')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('closes by itself after its duration without running Undo', () => {
    const undo = vi.fn();
    renderWith({ message: 'Archived', undo, duration: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText('Archived')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
    expect(undo).not.toHaveBeenCalled();
  });

  it('holds still while hovered or focused, then finishes the time it had left', () => {
    renderWith({ message: 'Archived', undo: vi.fn(), duration: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    const toast = screen.getByText('Archived').closest('.ak-toast')!;
    const undoButton = screen.getByRole('button', { name: 'Undo' });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Archived')).toBeInTheDocument();

    act(() => {
      undoButton.focus();
    });
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Archived')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'Dismiss' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('Archived')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: 'Dismiss' }).blur();
    });
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByText('Archived')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Archived')).not.toBeInTheDocument();
  });

  it('can be dismissed', () => {
    renderWith('Copied');
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Copied')).not.toBeInTheDocument();
  });

  it('throws a clear error outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger options="x" />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
