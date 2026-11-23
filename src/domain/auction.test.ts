import { describe, expect, it } from 'vitest';
import { deriveAuctionStatus, selectDisplayAuction, type AuctionStatus } from './auction';

const at = (iso: string) => new Date(iso);

describe('deriveAuctionStatus', () => {
  // 11:00–13:00 IST on 10 December.
  const schedule = { startsAt: '2026-12-10T05:30:00Z', endsAt: '2026-12-10T07:30:00Z' };

  it('is UPCOMING before the start', () => {
    expect(deriveAuctionStatus(schedule, at('2026-12-10T05:29:59Z'))).toBe('UPCOMING');
  });

  it('is LIVE from the start instant until the end', () => {
    expect(deriveAuctionStatus(schedule, at('2026-12-10T05:30:00Z'))).toBe('LIVE');
    expect(deriveAuctionStatus(schedule, at('2026-12-10T07:29:59Z'))).toBe('LIVE');
  });

  it('is ENDED from the end instant — which says nothing about a sale', () => {
    expect(deriveAuctionStatus(schedule, at('2026-12-10T07:30:00Z'))).toBe('ENDED');
  });

  it('lets a cancellation override the schedule', () => {
    const cancelled = { ...schedule, cancelledAt: '2026-12-01T00:00:00Z' };
    expect(deriveAuctionStatus(cancelled, at('2026-12-10T06:00:00Z'))).toBe('CANCELLED');
  });

  it('treats an unpublished date as UPCOMING', () => {
    expect(deriveAuctionStatus({ startsAt: null, endsAt: null }, at('2030-01-01T00:00:00Z'))).toBe('UPCOMING');
  });

  it('reads a start with no end as the whole IST day', () => {
    const dateOnly = { startsAt: '2026-12-10T05:30:00Z', endsAt: null };
    // 23:59:59 IST on the 10th, then midnight IST.
    expect(deriveAuctionStatus(dateOnly, at('2026-12-10T18:29:59Z'))).toBe('LIVE');
    expect(deriveAuctionStatus(dateOnly, at('2026-12-10T18:30:00Z'))).toBe('ENDED');
  });

  it('accepts Date values as well as ISO strings', () => {
    const fromDates = { startsAt: at(schedule.startsAt), endsAt: at(schedule.endsAt) };
    expect(deriveAuctionStatus(fromDates, at('2026-12-10T06:00:00Z'))).toBe('LIVE');
  });
});

describe('selectDisplayAuction', () => {
  const event = (id: string, status: AuctionStatus, startsAt: string | null) => ({ id, status, startsAt });

  it('prefers an auction that is live now', () => {
    const events = [event('next', 'UPCOMING', '2026-12-20T05:30:00Z'), event('now', 'LIVE', '2026-12-10T05:30:00Z')];
    expect(selectDisplayAuction(events)?.id).toBe('now');
  });

  it('otherwise picks the soonest dated upcoming auction', () => {
    const events = [
      event('later', 'UPCOMING', '2027-01-20T05:30:00Z'),
      event('sooner', 'UPCOMING', '2026-12-20T05:30:00Z'),
      event('past', 'ENDED', '2026-11-01T05:30:00Z'),
    ];
    expect(selectDisplayAuction(events)?.id).toBe('sooner');
  });

  it('ranks an undated upcoming auction after dated ones but before the past', () => {
    expect(selectDisplayAuction([event('tba', 'UPCOMING', null), event('dated', 'UPCOMING', '2026-12-20T05:30:00Z')])?.id).toBe(
      'dated',
    );
    expect(selectDisplayAuction([event('past', 'ENDED', '2026-11-01T05:30:00Z'), event('tba', 'UPCOMING', null)])?.id).toBe(
      'tba',
    );
  });

  it('falls back to the most recent event that already happened', () => {
    const events = [
      event('older', 'ENDED', '2026-09-01T05:30:00Z'),
      event('latest', 'CANCELLED', '2026-11-01T05:30:00Z'),
    ];
    expect(selectDisplayAuction(events)?.id).toBe('latest');
  });

  it('returns null when a listing has no events', () => {
    expect(selectDisplayAuction([])).toBeNull();
  });
});
