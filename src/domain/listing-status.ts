/**
 * Editorial lifecycle of a listing (01-FOUNDATION).
 *
 * Kept separate from the auction state on purpose: a listing stays PUBLISHED when its
 * auction ENDS, because the auction ending says nothing about whether the asset sold
 * (02). Only an admin moves a listing to CLOSED, and only on the bank's word.
 *
 *   DRAFT      not visible to anyone outside the admin
 *   PUBLISHED  listed publicly; its auction events carry their own derived status
 *   CLOSED     the bank concluded the matter — the asset sold, or the account settled
 *   CANCELLED  the bank withdrew the sale
 */
export type ListingStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

/**
 * Every transition the write service accepts. Anything absent is rejected.
 *
 * CLOSED and CANCELLED can be reversed because admins make mistakes and an admin tool
 * without an undo forces them into the database. Reinstating a cancelled listing lands
 * it in DRAFT so that going public again is a separate, deliberate publish — which
 * re-runs the publish checks (mandatory fields, a source notice) against current data.
 */
export const LISTING_TRANSITIONS: Readonly<Record<ListingStatus, readonly ListingStatus[]>> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['DRAFT', 'CLOSED', 'CANCELLED'],
  CLOSED: ['PUBLISHED'],
  CANCELLED: ['DRAFT'],
};

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return LISTING_TRANSITIONS[from].includes(to);
}

/**
 * Whether a listing may appear on any public surface — browse, detail, sitemap, alerts.
 * `publicScope()` in the listing repository is the query-side twin of this check; the
 * two must agree.
 */
export function isPubliclyListed(status: ListingStatus): boolean {
  return status === 'PUBLISHED';
}
