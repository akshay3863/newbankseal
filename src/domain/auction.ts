/**
 * Auction events.
 *
 * An auction is an event *on* a listing, not a property of it (02: one listing, many
 * auction events). When a sale fails and the bank re-offers the asset, that is a new
 * event with its own reserve, dates and notice — the earlier one is kept as history,
 * never overwritten.
 *
 * Only cancellation is stored. Every other state is derived from the schedule at read
 * time, so it cannot go stale waiting for a job to flip it, and ENDED can never be
 * mistaken for "sold": the clock running out says nothing about whether anyone bought
 * the asset. Whether a listing concluded is the listing's status, set by an admin.
 */

export type AuctionStatus = 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';

/** Where a listing's facts came from. The bank's notice is authoritative over this site. */
export interface AuctionSource {
  noticeUrl: string;
  /** Notice or reference number exactly as the bank prints it. */
  reference: string | null;
  /** When an admin last checked this event against the notice. ISO-8601 UTC. */
  lastVerifiedAt: string | null;
}

export interface AuctionEvent {
  id: string;
  listingId: string;
  bankSlug: string;
  bankName: string;
  /** Whole rupees. Stored as paise and converted only at the DTO boundary. */
  reservePriceInr: number;
  emdAmountInr: number;
  bidIncrementInr: number | null;
  /** ISO-8601 UTC. Null while the bank has not published a date. */
  startsAt: string | null;
  endsAt: string | null;
  emdDeadlineAt: string | null;
  status: AuctionStatus;
  /** True when an earlier event on the same listing ended without a sale. */
  isReauction: boolean;
  source: AuctionSource | null;
  /**
   * Contact details exactly as the bank's own notice publishes them. The auction desk's
   * direct line on the bank record stays gated; this is only what is already public.
   */
  publicContact: string | null;
}

export interface AuctionSchedule {
  startsAt: string | Date | null;
  endsAt: string | Date | null;
  cancelledAt?: string | Date | null;
}

const DAY_MS = 86_400_000;
/** Asia/Kolkata is UTC+05:30 all year — India observes no daylight saving. */
const IST_OFFSET_MS = 330 * 60_000;

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The instant the IST calendar day containing `instant` ends. */
function endOfIstDay(instant: Date): Date {
  const startOfIstDay = Math.floor((instant.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS;
  return new Date(startOfIstDay + DAY_MS - IST_OFFSET_MS);
}

/**
 * Status of one auction event at `now`.
 *
 * - No published start date: UPCOMING ("date to be announced") — it has not happened.
 * - A start but no end: live for the rest of that IST day. Notices that give only a
 *   date are read the way a bidder reads them, as that whole day in India.
 */
export function deriveAuctionStatus(schedule: AuctionSchedule, now: Date = new Date()): AuctionStatus {
  if (toDate(schedule.cancelledAt)) return 'CANCELLED';

  const startsAt = toDate(schedule.startsAt);
  if (!startsAt || now < startsAt) return 'UPCOMING';

  const endsAt = toDate(schedule.endsAt) ?? endOfIstDay(startsAt);
  return now < endsAt ? 'LIVE' : 'ENDED';
}

/**
 * The event a listing should display: the one a bidder can still act on, otherwise the
 * most recent one that happened (02: "designate next/current auction for display").
 *
 * Order: LIVE → soonest dated UPCOMING → undated UPCOMING → latest of ENDED/CANCELLED.
 */
export function selectDisplayAuction<T extends Pick<AuctionEvent, 'status' | 'startsAt'>>(
  events: readonly T[],
): T | null {
  const startOf = (event: T) => toDate(event.startsAt)?.getTime() ?? null;

  const live = events.filter((event) => event.status === 'LIVE');
  if (live.length > 0) return earliest(live, startOf);

  const upcoming = events.filter((event) => event.status === 'UPCOMING');
  const dated = upcoming.filter((event) => startOf(event) !== null);
  if (dated.length > 0) return earliest(dated, startOf);
  if (upcoming.length > 0) return upcoming[0] ?? null;

  const past = events.filter((event) => event.status === 'ENDED' || event.status === 'CANCELLED');
  return latest(past, startOf);
}

function earliest<T>(items: readonly T[], key: (item: T) => number | null): T | null {
  let best: T | null = null;
  let bestKey = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const value = key(item) ?? Number.POSITIVE_INFINITY;
    if (best === null || value < bestKey) {
      best = item;
      bestKey = value;
    }
  }
  return best;
}

function latest<T>(items: readonly T[], key: (item: T) => number | null): T | null {
  let best: T | null = null;
  let bestKey = Number.NEGATIVE_INFINITY;
  for (const item of items) {
    const value = key(item) ?? Number.NEGATIVE_INFINITY;
    if (best === null || value > bestKey) {
      best = item;
      bestKey = value;
    }
  }
  return best;
}
