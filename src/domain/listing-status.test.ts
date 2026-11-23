import { describe, expect, it } from 'vitest';
import { canTransition, isPubliclyListed, LISTING_TRANSITIONS, type ListingStatus } from './listing-status';

const STATUSES = Object.keys(LISTING_TRANSITIONS) as ListingStatus[];

describe('listing lifecycle', () => {
  it('publishes a draft and can unpublish it again', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransition('PUBLISHED', 'DRAFT')).toBe(true);
  });

  it('closes or cancels only through deliberate transitions', () => {
    expect(canTransition('PUBLISHED', 'CLOSED')).toBe(true);
    expect(canTransition('PUBLISHED', 'CANCELLED')).toBe(true);
    // A draft was never public, so there is nothing to close.
    expect(canTransition('DRAFT', 'CLOSED')).toBe(false);
  });

  it('reinstates a cancelled listing as a draft, never straight back to public', () => {
    expect(canTransition('CANCELLED', 'DRAFT')).toBe(true);
    expect(canTransition('CANCELLED', 'PUBLISHED')).toBe(false);
  });

  it('can reopen a mistaken closure, but not as a draft', () => {
    expect(canTransition('CLOSED', 'PUBLISHED')).toBe(true);
    expect(canTransition('CLOSED', 'DRAFT')).toBe(false);
  });

  it('has no self-transitions', () => {
    for (const status of STATUSES) expect(canTransition(status, status)).toBe(false);
  });

  it('lists only PUBLISHED listings publicly', () => {
    expect(STATUSES.filter(isPubliclyListed)).toEqual(['PUBLISHED']);
  });
});
