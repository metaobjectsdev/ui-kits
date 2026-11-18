import { render, screen } from '@testing-library/react';
import { Field, inputClass } from '../src/index.js';

describe('Field', () => {
  it('treats error={false} and hint={false} as absent', () => {
    const touched = false;
    const { container } = render(
      <Field label="Name" hint={touched && 'Shown on receipts'} error={touched && 'Required'}>
        <input />
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(container.querySelector('.ak-error-text, .ak-hint')).toBeNull();
  });

  it('binds its label to the control it wraps', () => {
    render(
      <Field label="Email">
        <input type="email" className={inputClass} />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAttribute('id');
  });

  it('keeps an id the control already has', () => {
    render(
      <Field label="Program">
        <select id="program">
          <option>One</option>
        </select>
      </Field>,
    );
    expect(screen.getByLabelText('Program')).toHaveAttribute('id', 'program');
  });

  it('gives each field its own id', () => {
    render(
      <>
        <Field label="First">
          <input />
        </Field>
        <Field label="Second">
          <input />
        </Field>
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe(screen.getByLabelText('Second').id);
  });

  it('describes the control with its hint and error and marks it invalid', () => {
    render(
      <Field label="Price" hint="What customers pay today." error="Enter a price.">
        <input aria-describedby="extra" />
      </Field>,
    );
    const input = screen.getByLabelText('Price');
    // The child's own describedby id ("extra", not in the document) is kept alongside them.
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual(['extra', `${input.id}-hint`, `${input.id}-error`]);
    expect(input).toHaveAccessibleDescription('What customers pay today. Enter a price.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('passes the binding props to a render function', () => {
    render(
      <Field label="Title" hint="Shown on the card." required>
        {(control) => (
          <div>
            <input {...control} />
          </div>
        )}
      </Field>,
    );
    const input = screen.getByLabelText(/Title/);
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Shown on the card.');
  });
});
