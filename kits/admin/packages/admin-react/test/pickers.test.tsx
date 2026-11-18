import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Field, FileInput, LookupPicker, acceptsFile, type LookupOption } from '../src/index.js';

const PEOPLE: LookupOption[] = [
  { id: 'p1', label: 'Ana Example', hint: 'ana@example.com' },
  { id: 'p2', label: 'Ben Example', hint: 'ben@example.com' },
  { id: 'p3', label: 'Cy Sample' },
];

function Picker({ search, onChange = () => {} }: { search: (q: string, s: AbortSignal) => Promise<ReadonlyArray<LookupOption>>; onChange?: (o: LookupOption | null) => void }) {
  const [value, setValue] = useState<LookupOption | null>(null);
  return (
    <>
      <Field label="Person">
        <LookupPicker
          value={value}
          delay={0}
          search={search}
          data-testid="p.filter.person"
          onChange={(option) => {
            onChange(option);
            setValue(option);
          }}
        />
      </Field>
      <button type="button">elsewhere</button>
    </>
  );
}

const byText = (q: string) => Promise.resolve(PEOPLE.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())));

describe('LookupPicker', () => {
  it('is a labelled combobox that lists matches and picks with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Picker search={byText} onChange={onChange} />);
    const box = screen.getByRole('combobox', { name: 'Person' });
    await user.type(box, 'exa');
    const list = await screen.findByRole('listbox');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    expect(list).toHaveTextContent('ana@example.com');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}');
    expect(box.getAttribute('aria-activedescendant')).toMatch(/p2$/);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(PEOPLE[1]);
    expect(box).toHaveValue('Ben Example');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('shows only the latest answer when searches return out of order', async () => {
    const user = userEvent.setup();
    const pending: Array<{ q: string; resolve: (v: LookupOption[]) => void }> = [];
    const search = (q: string) => new Promise<LookupOption[]>((resolve) => pending.push({ q, resolve }));
    render(<Picker search={search} />);
    await user.type(screen.getByRole('combobox'), 'c');
    await waitFor(() => expect(pending.map((p) => p.q)).toContain('c'));
    const slow = pending.find((p) => p.q === 'c')!;
    await user.type(screen.getByRole('combobox'), 'y');
    await waitFor(() => expect(pending.map((p) => p.q)).toContain('cy'));
    pending.find((p) => p.q === 'cy')!.resolve([PEOPLE[2]!]);
    await screen.findByRole('option', { name: 'Cy Sample' });
    slow.resolve([PEOPLE[0]!]);
    await new Promise((r) => setTimeout(r, 10));
    expect(screen.queryByRole('option', { name: /Ana/ })).toBeNull();
  });

  it('cannot pick an option from a superseded search while the newer one is pending', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const pending: Array<{ q: string; resolve: (v: LookupOption[]) => void }> = [];
    const search = (q: string) => new Promise<LookupOption[]>((resolve) => pending.push({ q, resolve }));
    render(<Picker search={search} onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.type(box, 'ab');
    await waitFor(() => expect(pending.map((p) => p.q)).toContain('ab'));
    pending.find((p) => p.q === 'ab')!.resolve([PEOPLE[0]!]);
    await screen.findByRole('option', { name: /Ana/ });
    await user.type(box, 'c');
    await waitFor(() => expect(pending.map((p) => p.q)).toContain('abc'));
    expect(screen.queryByRole('option')).toBeNull();
    expect(box).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores the chosen label on blur, never keeping free text, and clears', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Picker search={byText} onChange={onChange} />);
    const box = screen.getByRole('combobox');
    await user.type(box, 'cy');
    await user.click(await screen.findByRole('option', { name: 'Cy Sample' }));
    await user.clear(box);
    await user.type(box, 'zzz');
    await user.click(screen.getByRole('button', { name: 'elsewhere' }));
    expect(box).toHaveValue('Cy Sample');
    await user.click(screen.getByRole('button', { name: 'Clear Cy Sample' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(box).toHaveValue('');
  });

  it('says when nothing matches or the search failed', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Picker search={byText} />);
    await user.type(screen.getByRole('combobox'), 'qqq');
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    unmount();
    render(<Picker search={() => Promise.reject(new Error('500'))} />);
    await user.type(screen.getByRole('combobox'), 'a');
    expect(await screen.findByText('Search failed. Type to try again.')).toBeInTheDocument();
  });
});

describe('FileInput', () => {
  const png = new File(['x'.repeat(2048)], 'logo.png', { type: 'image/png' });

  it('accepts an image and shows its name and size, and removes it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Field label="Logo">
        <FileInput onChange={onChange} maxBytes={10_000} data-testid="p.form.logo" />
      </Field>,
    );
    const input = screen.getByLabelText('Logo') as HTMLInputElement;
    expect(input.accept).toBe('image/*');
    await user.upload(input, png);
    expect(onChange).toHaveBeenCalledWith(png);
    expect(screen.getByTestId('p.form.logo')).toHaveTextContent('logo.png2.0 KB');
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('rejects a file of the wrong type or over the limit', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onChange = vi.fn();
    render(<FileInput onChange={onChange} maxBytes={1000} aria-describedby="hint" />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an image file.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toMatch(/^hint .*-error$/);
    await user.upload(input, png);
    expect(screen.getByRole('alert')).toHaveTextContent('The file is 2.0 KB; the limit is 1000 B.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('matches accept lists by type, wildcard and extension', () => {
    expect(acceptsFile(png, 'image/*')).toBe(true);
    expect(acceptsFile(png, 'image/jpeg, .png')).toBe(true);
    expect(acceptsFile(png, 'image/jpeg')).toBe(false);
    expect(acceptsFile(png, '')).toBe(true);
  });

  it('renders no image unless a preview is asked for (the strict content policy blocks blob: images)', async () => {
    const user = userEvent.setup();
    render(<FileInput onChange={() => {}} />);
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, png);
    expect(document.querySelector('img')).toBeNull();
  });
});
