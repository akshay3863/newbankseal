import type { ListingFilters } from './listing';

/**
 * A signed-in user's own data: saved searches and notification preferences.
 *
 * Every read and write of these is scoped to the session's user id on the server. The
 * client never sends a user id, and an id in a URL addresses a row only within the
 * caller's own set — another user's saved search is a 404, not a 403, so its
 * existence is not confirmed either.
 */

export type AlertFrequency = 'DAILY' | 'WEEKLY';

/** The filters a saved search stores: browse filters minus paging and sort. */
export type SavedSearchFilters = Omit<ListingFilters, 'sort' | 'page' | 'perPage' | 'auctionStatus'> & {
  /** 05's "auction timing": only lots whose auction starts within this many days. */
  auctionWithinDays?: number;
};

export interface SavedSearch {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  frequency: AlertFrequency;
  /**
   * Whether this search sends digests. Off until the user turns it on — new-listing
   * alerts are marketing-style mail and need explicit opt-in (05).
   */
  alertsEnabled: boolean;
  /** End of the last digest window delivered for this search. ISO-8601 UTC. */
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One row per user. Transactional mail — email verification, password reset — is not a
 * preference and is always sent; everything here is opt-in and off by default (05, 06).
 */
export interface NotificationPreference {
  /** Reminder 24 hours before an auction starts, for listings the user saved. */
  auctionReminders: boolean;
  /** New-listing digests. Each saved search's own `alertsEnabled` must also be on. */
  savedSearchDigests: boolean;
  updatedAt: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCE: NotificationPreference = {
  auctionReminders: false,
  savedSearchDigests: false,
  updatedAt: null,
};
