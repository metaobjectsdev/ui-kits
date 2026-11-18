// Pure formatters behind Value, DataTable's CSV export and PeriodControl. Each rule here is
// a kit rule: an unknown value is "—", money keeps its sign and cents, a date is a UTC day,
// a timestamp is relative with the exact time beside it, and a link is http or https only.

/** What an unknown or null value renders as. Never 0 and never an empty string. */
export const UNKNOWN_TEXT = '—';

/** True for a value the kit renders as unknown: null, undefined, NaN, an invalid Date, '' or blank text. */
export function isUnknown(value: unknown): value is null | undefined | '' {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  if (value instanceof Date) return Number.isNaN(value.getTime());
  return false;
}

// ─── Money ───────────────────────────────────────────────

/**
 * `billed`: money that was or will be charged. `notional`: an estimate or list-price
 * equivalent that nobody pays. The two never share a total or a chart axis.
 */
export type MoneyKind = 'billed' | 'notional';

export interface MoneyFormat {
  /** ISO 4217 code. Default USD. */
  currency?: string;
  /** `minor` when the number is in cents (or the currency's minor unit). Default `major`. */
  unit?: 'major' | 'minor';
  /** Show a plus sign on positive amounts too, for deltas. */
  signed?: boolean;
  locale?: string;
}

const DEFAULT_LOCALE = 'en-US';

function minorDigits(currency: string, locale: string): number {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Money with its sign and its cents: -1234.5 USD → "-$1,234.50". Negative amounts carry a
 * minus sign, never parentheses, and whole amounts still show the cents.
 */
export function formatMoney(amount: number, { currency = 'USD', unit = 'major', signed = false, locale = DEFAULT_LOCALE }: MoneyFormat = {}): string {
  const digits = minorDigits(currency, locale);
  const major = unit === 'minor' ? amount / 10 ** digits : amount;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(major);
}

export interface MoneyAmount {
  amount: number;
  moneyKind: MoneyKind;
  currency?: string;
}

/** Thrown when billed and notional money (or two currencies) would be added together. */
export class MixedMoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MixedMoneyError';
  }
}

/**
 * Adds amounts of one money kind and one currency. Mixing billed with notional, or two
 * currencies, throws MixedMoneyError rather than producing a total that means nothing.
 */
export function sumMoney(amounts: ReadonlyArray<MoneyAmount>): MoneyAmount | null {
  const first = amounts[0];
  if (!first) return null;
  const currency = first.currency ?? 'USD';
  let total = 0;
  for (const item of amounts) {
    if (item.moneyKind !== first.moneyKind) throw new MixedMoneyError(`Cannot total ${first.moneyKind} and ${item.moneyKind} money`);
    if ((item.currency ?? 'USD') !== currency) throw new MixedMoneyError(`Cannot total ${currency} and ${item.currency ?? 'USD'}`);
    total += item.amount;
  }
  return { amount: total, moneyKind: first.moneyKind, currency };
}

/** Throws MixedMoneyError when the kinds differ: call it before putting money series on one axis. */
export function assertOneMoneyKind(kinds: ReadonlyArray<MoneyKind>): void {
  if (new Set(kinds).size > 1) throw new MixedMoneyError('Billed and notional money cannot share an axis or a total');
}

// ─── Dates ───────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A Date for a value: a `YYYY-MM-DD` day is midnight UTC; a number is epoch milliseconds. */
export function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const day = DAY_RE.exec(value);
  if (day) return new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
  return new Date(value);
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** The UTC day of a value as `YYYY-MM-DD`. Never shifted by the browser's time zone. */
export function formatUtcDay(value: Date | string | number): string {
  const d = toDate(value);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The exact instant in UTC, to the second: `2026-11-14 09:14:03 UTC`. */
export function formatExactUtc(value: Date | string | number): string {
  const d = toDate(value);
  return `${formatUtcDay(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/**
 * How long ago (or until) an instant is, in the largest whole unit: "just now",
 * "12 min ago", "3 h ago", "2 d ago", "in 5 min". Beyond 30 days it is the UTC day.
 */
export function formatRelative(value: Date | string | number, now: Date | number = Date.now()): string {
  const then = toDate(value).getTime();
  const diff = (typeof now === 'number' ? now : now.getTime()) - then;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < 45_000) return 'just now';
  let text: string;
  if (abs < hour) text = `${Math.min(59, Math.round(abs / minute))} min`;
  else if (abs < day) text = `${Math.floor(abs / hour)} h`;
  else if (abs < 30 * day) text = `${Math.floor(abs / day)} d`;
  else return formatUtcDay(then);
  return diff >= 0 ? `${text} ago` : `in ${text}`;
}

// ─── Links ───────────────────────────────────────────────

/** The URL when its scheme is http or https, otherwise null. Untrusted text stays text. */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** The rel every external link carries. */
export const EXTERNAL_REL = 'noopener noreferrer nofollow';

// ─── Numbers ─────────────────────────────────────────────

export function formatNumber(value: number, { locale = DEFAULT_LOCALE, maximumFractionDigits = 2 }: { locale?: string; maximumFractionDigits?: number } = {}): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}
