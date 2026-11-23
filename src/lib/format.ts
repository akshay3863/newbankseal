/** Locale-aware formatters shared by every surface. Indian conventions throughout. */

/**
 * Every date and time renders in India time, whatever zone the process runs in
 * (01-FOUNDATION: store UTC, display Asia/Kolkata). Without this the formatters used
 * the host's zone: correct on a developer's machine in India, five and a half hours
 * off on a UTC server — an 11:00 auction shown as 05:30 — and different again in a
 * visitor's browser abroad, which also made server and client markup disagree.
 */
export const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const COMPACT = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: DISPLAY_TIME_ZONE,
});

/**
 * Money is stored in the database as an integer number of paise to avoid float drift.
 * Format converts back to rupees for display.
 */
export function formatPaiseAsInr(paise: number | bigint): string {
  const rupees = Number(paise) / 100;
  return INR.format(rupees);
}

export function formatInr(rupees: number): string {
  return INR.format(rupees);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatCompact(value: number): string {
  return COMPACT.format(value);
}

export function formatDate(value: Date | string): string {
  return DATE.format(typeof value === 'string' ? new Date(value) : value);
}

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: DISPLAY_TIME_ZONE,
});

/**
 * Auction schedules are legally significant, so they always render with the time and
 * never as a bare date that could be read as end-of-day.
 */
export function formatDateTime(value: Date | string): string {
  return DATE_TIME.format(typeof value === 'string' ? new Date(value) : value);
}
