// Period arithmetic for PeriodControl. Every day is a UTC day written `YYYY-MM-DD`, and a
// range includes both ends.
import { formatUtcDay, toDate } from './format.js';

export type PeriodPreset = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'month' | 'thisYear' | 'custom';

export const PERIOD_PRESETS: readonly PeriodPreset[] = ['today', '7d', '30d', 'thisMonth', 'lastMonth', 'month', 'thisYear', 'custom'];

export interface Period {
  preset: PeriodPreset;
  /** `YYYY-MM`, for the `month` preset. Defaults to the current month. */
  month?: string;
  /** Inclusive `YYYY-MM-DD` days, for the `custom` preset. */
  from?: string;
  to?: string;
}

/** An inclusive range of UTC days. */
export interface DayRange {
  from: string;
  to: string;
}

const DAY = 86_400_000;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isDay(day: string): boolean {
  return DAY_RE.test(day) && formatUtcDay(toDate(day)) === day;
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}
function addDays(day: string, n: number): string {
  return formatUtcDay(toDate(day).getTime() + n * DAY);
}
function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY);
}
function monthRange(year: number, month: number): DayRange {
  return { from: formatUtcDay(utc(year, month, 1)), to: formatUtcDay(utc(year, month + 1, 0)) };
}

/** The current month as `YYYY-MM`. */
export function currentMonth(today: Date = new Date()): string {
  return formatUtcDay(today).slice(0, 7);
}

/** Moves a `YYYY-MM` month by `n` months. */
export function stepMonth(month: string, n: number): string {
  const match = MONTH_RE.exec(month);
  if (!match) return month;
  return formatUtcDay(utc(Number(match[1]), Number(match[2]) - 1 + n, 1)).slice(0, 7);
}

/** The days a period covers, as of `today` (UTC). */
export function resolvePeriod(period: Period, today: Date = new Date()): DayRange {
  const day = formatUtcDay(today);
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  switch (period.preset) {
    case 'today':
      return { from: day, to: day };
    case '7d':
      return { from: addDays(day, -6), to: day };
    case '30d':
      return { from: addDays(day, -29), to: day };
    case 'thisMonth':
      return { from: formatUtcDay(utc(y, m, 1)), to: day };
    case 'lastMonth':
      return monthRange(y, m - 1);
    case 'month': {
      const match = MONTH_RE.exec(period.month ?? '');
      return match ? monthRange(Number(match[1]), Number(match[2]) - 1) : monthRange(y, m);
    }
    case 'thisYear':
      return { from: formatUtcDay(utc(y, 0, 1)), to: day };
    case 'custom': {
      const from = period.from && isDay(period.from) ? period.from : day;
      const to = period.to && isDay(period.to) ? period.to : from;
      return from <= to ? { from, to } : { from: to, to: from };
    }
  }
}

/**
 * The period a "vs previous period" comparison uses. Whole months compare with the whole
 * month before; month-to-date and year-to-date compare with the same span a month or a
 * year earlier; anything else with the same number of days just before it.
 */
export function previousRange(period: Period, range: DayRange): DayRange {
  const from = toDate(range.from);
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  if (period.preset === 'lastMonth' || period.preset === 'month') return monthRange(y, m - 1);
  if (period.preset === 'thisMonth' || period.preset === 'thisYear') {
    const back = period.preset === 'thisMonth' ? { y, m: m - 1 } : { y: y - 1, m };
    const start = utc(back.y, back.m, 1);
    const span = daysBetween(range.from, range.to);
    const limit = period.preset === 'thisMonth' ? utc(back.y, back.m + 1, 0) : utc(back.y, 11, 31);
    const end = Math.min(start.getTime() + span * DAY, limit.getTime());
    return { from: formatUtcDay(start), to: formatUtcDay(end) };
  }
  const length = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/**
 * The period as one query value: a preset name, `YYYY-MM` for a month, or
 * `YYYY-MM-DD..YYYY-MM-DD` for a custom range.
 */
export function encodePeriod(period: Period): string {
  if (period.preset === 'month') return period.month && MONTH_RE.test(period.month) ? period.month : 'month';
  if (period.preset === 'custom') return `${period.from ?? ''}..${period.to ?? ''}`;
  return period.preset;
}

/** Reads a query value written by encodePeriod. Anything else is null. */
export function decodePeriod(value: string | null | undefined): Period | null {
  if (!value) return null;
  if (MONTH_RE.test(value)) return { preset: 'month', month: value };
  const custom = /^(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$/.exec(value);
  if (custom) {
    const [, from, to] = custom;
    if ((from && !isDay(from)) || (to && !isDay(to))) return null;
    return { preset: 'custom', from, to };
  }
  return (PERIOD_PRESETS as readonly string[]).includes(value) ? { preset: value as PeriodPreset } : null;
}

/** "November 2026", in UTC. */
export function formatMonth(month: string, locale = 'en-US'): string {
  const match = MONTH_RE.exec(month);
  if (!match) return month;
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utc(Number(match[1]), Number(match[2]) - 1, 1));
}

/** "2026-11-01 – 2026-11-14", or one day. */
export function formatRange(range: DayRange): string {
  return range.from === range.to ? range.from : `${range.from} – ${range.to}`;
}
