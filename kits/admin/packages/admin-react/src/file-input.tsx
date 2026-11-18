import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, inputClass } from './controls.js';
import { cx } from './cx.js';

/** "820 B", "14.2 KB", "3.1 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** True when a file's type or extension matches an `accept` list such as `image/*,.pdf`. */
export function acceptsFile(file: File, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (!rules.length) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export interface FileInputProps {
  /** Called with a file that passed the checks, or null when removed. */
  onChange: (file: File | null) => void;
  /** Default `image/*`. Checked again on pick, since a picker's filter is only a hint. */
  accept?: string;
  /** The largest file allowed, in bytes. */
  maxBytes?: number;
  /** What is stored now, such as the current image's file name, shown until a new file is picked. */
  current?: ReactNode;
  /**
   * Shows a thumbnail of the picked image from a `blob:` URL. Off by default: the page's
   * content policy must allow `img-src blob:`, which the kit's strict policy does not.
   */
  preview?: boolean;
  /** Passed to the input, to offer the camera on a phone. */
  capture?: 'user' | 'environment';
  id?: string;
  'aria-describedby'?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Picks one file, an image by default, on the native file input. It rejects a file of the
 * wrong type or over `maxBytes` with a message, shows the chosen file's name and size,
 * and offers Remove.
 */
export function FileInput({ onChange, accept = 'image/*', maxBytes, current, preview = false, capture, id, 'aria-describedby': describedBy, disabled = false, 'data-testid': testId }: FileInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!preview || !file) return;
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
      setUrl(null);
    };
  }, [preview, file]);

  const reset = () => {
    if (input.current) input.current.value = '';
  };

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    if (!acceptsFile(picked, accept)) {
      setError(accept === 'image/*' ? 'Choose an image file.' : `Choose a file of type ${accept}.`);
      reset();
      return;
    }
    if (maxBytes != null && picked.size > maxBytes) {
      setError(`The file is ${formatBytes(picked.size)}; the limit is ${formatBytes(maxBytes)}.`);
      reset();
      return;
    }
    setError(null);
    setFile(picked);
    onChange(picked);
  };

  return (
    <div className="ak-file" data-testid={testId}>
      <input
        ref={input}
        id={inputId}
        type="file"
        className={inputClass}
        accept={accept}
        capture={capture}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={cx(describedBy, error && errorId) || undefined}
        onChange={(event) => pick(event.target.files?.[0])}
      />
      {(file || current != null) && (
        <div className="ak-file-chosen">
          {url && <img className="ak-file-thumb" src={url} alt="" />}
          <span className="ak-file-name">{file ? file.name : current}</span>
          {file && <span className="ak-file-size ak-num">{formatBytes(file.size)}</span>}
          {file && (
            <Button
              variant="quietDanger"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setFile(null);
                reset();
                onChange(null);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      )}
      {error && (
        <div className="ak-error-text" id={errorId} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
