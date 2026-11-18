// CSV shared by DataTable and the charts' table form: RFC 4180 cells and a download.
import { isUnknown } from './format.js';

/** One RFC 4180 cell. Unknown is empty; a cell a spreadsheet would run as a formula is defused. */
export function csvCell(value: unknown): string {
  if (isUnknown(value)) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  // A spreadsheet would run a cell that starts with = + - @ as a formula; a number is never one.
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Saves text as a file through a temporary link. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
