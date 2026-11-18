import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { THEME_STORAGE_KEY, ThemeToggle, initTheme, readTheme, setTheme } from '../src/index.js';

const html = document.documentElement;

describe('theme contract', () => {
  it('uses the one shared storage key', () => {
    expect(THEME_STORAGE_KEY).toBe('admin-theme');
  });

  it('pins the theme on <html> and stores the choice', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    expect(html).not.toHaveAttribute('data-theme');

    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(html).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('admin-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Light' }));
    expect(html).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('admin-theme')).toBe('light');
  });

  it('Auto unpins the theme and clears the stored key', async () => {
    const user = userEvent.setup();
    localStorage.setItem('admin-theme', 'dark');
    render(<ThemeToggle />);
    expect(html).toHaveAttribute('data-theme', 'dark');

    await user.click(screen.getByRole('button', { name: 'Auto' }));
    expect(html).not.toHaveAttribute('data-theme');
    expect(localStorage.getItem('admin-theme')).toBeNull();
  });

  it('starts from the stored choice', () => {
    localStorage.setItem('admin-theme', 'light');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(html).toHaveAttribute('data-theme', 'light');
  });

  it('treats an unknown stored value as auto', () => {
    localStorage.setItem('admin-theme', 'sepia');
    expect(readTheme()).toBe('auto');
    expect(initTheme()).toBe('auto');
    expect(html).not.toHaveAttribute('data-theme');
  });

  it('keeps every toggle on the page in step', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ThemeToggle label="Rail theme" />
        <ThemeToggle label="Menu theme" />
      </>,
    );
    await user.click(within(screen.getByRole('group', { name: 'Rail theme' })).getByRole('button', { name: 'Dark' }));
    expect(within(screen.getByRole('group', { name: 'Menu theme' })).getByRole('button', { name: 'Dark' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('follows the plain setTheme() helper', () => {
    render(<ThemeToggle />);
    act(() => {
      setTheme('light');
    });
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('follows a change made in another tab', () => {
    render(<ThemeToggle />);
    act(() => {
      localStorage.setItem('admin-theme', 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: 'admin-theme', newValue: 'dark' }));
    });
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(html).toHaveAttribute('data-theme', 'dark');
  });

  it('keeps working when storage throws', async () => {
    const user = userEvent.setup();
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      expect(readTheme()).toBe('auto');
      render(<ThemeToggle />);
      await user.click(screen.getByRole('button', { name: 'Dark' }));
      expect(html).toHaveAttribute('data-theme', 'dark');
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});
