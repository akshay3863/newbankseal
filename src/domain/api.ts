import type { PublicError } from '@/lib/errors';

/**
 * Wire contract for every JSON API route — 01-FOUNDATION's `{ data, error, meta }`.
 *
 * Exactly one of `data` and `error` is non-null, so a caller branches on `error` and
 * never has to infer success from a status code. `meta.requestId` is always present:
 * it is the id a user quotes to support, and the one stamped on the server's log line
 * and audit row for the same request.
 *
 * Route handlers never build this by hand. `defineRoute` hands them a `respond` helper
 * that produces it, and serialises every thrown error into `ApiFailure` through
 * `toPublicError`, so the shape cannot drift between endpoints.
 */

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ApiMeta {
  requestId: string;
  /** Present on list endpoints only. */
  pagination?: PageMeta;
}

/** Same shape `toPublicError` produces; field messages are authored by our schemas. */
export type ApiErrorBody = PublicError;

export interface ApiSuccess<T> {
  data: T;
  error: null;
  meta: ApiMeta;
}

export interface ApiFailure {
  data: null;
  error: ApiErrorBody;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/**
 * Page-number pagination, used by every list — services and endpoints alike.
 *
 * Pages rather than cursors because the browse UI shows numbered pages and a total,
 * and the public inventory is small enough that a bounded OFFSET is cheap. The bounds
 * below are part of the contract: a crafted `?page=999999` must not become a huge scan.
 */
export interface PaginatedResult<T> extends PageMeta {
  items: T[];
}

export const MAX_PAGE = 500;
export const MAX_PER_PAGE = 50;
