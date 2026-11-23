import 'server-only';

import { forbidden, unauthenticated } from '@/lib/errors';
import type { SessionContext } from './session';

/**
 * Permission-based access control.
 *
 * Call sites ask for a *permission*, never a role — `require(session, 'listing:publish')`
 * rather than `if (user.role === 'admin')`. Adding a role then means editing one table
 * here instead of auditing every branch in the codebase, and privilege escalation has
 * a single place to get wrong (and a single place to review).
 */

export type Role = 'buyer' | 'seller' | 'bank_officer' | 'admin';

/**
 * 01-FOUNDATION defines two roles, USER and SUPER_ADMIN. They are stored as `buyer` and
 * `admin`: renaming Postgres enum values buys nothing, and the stored names already
 * appear in sessions and in audit rows.
 *
 * `seller` and `bank_officer` stay in the enum but nothing assigns them. Sign-up always
 * creates a `buyer`, and the only way to `admin` is the provisioning CLI (03) — no
 * request can choose its own role.
 */
export const USER_ROLE = 'buyer' satisfies Role;
export const SUPER_ADMIN_ROLE = 'admin' satisfies Role;

export const ROLE_LABEL: Record<Role, string> = {
  buyer: 'User',
  seller: 'Seller',
  bank_officer: 'Bank officer',
  admin: 'Super Admin',
};

/**
 * `listing:view_protected` covers the borrower's name, the full address, the bank's
 * auction desk and the notice PDF — personal and contact data that must not be
 * scrapable. It is granted to internal roles here; the product also sells it to
 * subscribers, which needs a subscription model this schema does not yet have. Until
 * that exists a buyer sees the locked state, which is the honest answer.
 */
export type Permission =
  | 'listing:read_public'
  | 'listing:read_any'
  | 'listing:view_protected'
  | 'listing:create'
  | 'listing:update_own'
  | 'listing:update_any'
  | 'listing:publish'
  | 'listing:delete'
  | 'watchlist:manage'
  | 'enquiry:create'
  | 'enquiry:read_own'
  | 'enquiry:read_any'
  | 'user:read_any'
  | 'user:update_role'
  | 'user:suspend'
  | 'audit:read'
  // Declared up front by the foundation workstream so feature workstreams never need to
  // edit this file (10: shared files belong to the integration owner).
  /** Enter `/admin/**` at all. Each admin write still checks its own permission. */
  | 'admin:access'
  | 'auction:manage'
  /** Sign uploads, attach, reorder and delete listing media. */
  | 'media:manage'
  | 'bank:manage'
  | 'location:manage'
  /** The caller's *own* saved searches and alert settings — never another user's. */
  | 'saved_search:manage'
  | 'notification_pref:manage'
  /** Delivery logs and template previews in the admin. */
  | 'notification:read_any';

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  buyer: [
    'listing:read_public',
    'watchlist:manage',
    'enquiry:create',
    'enquiry:read_own',
    'saved_search:manage',
    'notification_pref:manage',
  ],
  seller: [
    'listing:read_public',
    'listing:create',
    'listing:update_own',
    'watchlist:manage',
    'enquiry:create',
    'enquiry:read_own',
  ],
  bank_officer: [
    'listing:read_public',
    'listing:read_any',
    'listing:view_protected',
    'listing:create',
    'listing:update_own',
    'listing:update_any',
    'listing:publish',
    'enquiry:read_any',
  ],
  admin: [
    'listing:read_public',
    'listing:read_any',
    'listing:view_protected',
    'listing:create',
    'listing:update_own',
    'listing:update_any',
    'listing:publish',
    'listing:delete',
    'watchlist:manage',
    'enquiry:create',
    'enquiry:read_own',
    'enquiry:read_any',
    'user:read_any',
    'user:update_role',
    'user:suspend',
    'audit:read',
    'admin:access',
    'auction:manage',
    'media:manage',
    'bank:manage',
    'location:manage',
    'saved_search:manage',
    'notification_pref:manage',
    'notification:read_any',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Assert a permission, narrowing the session type for the caller.
 * Throws `UNAUTHENTICATED` when signed out and `FORBIDDEN` when signed in but unentitled —
 * both are rendered to the client through `toPublicError`, which reveals neither the
 * permission name nor the caller's role.
 */
export function requirePermission(
  session: SessionContext | null,
  permission: Permission,
): asserts session is SessionContext {
  if (!session) throw unauthenticated();
  if (!hasPermission(session.user.role, permission)) throw forbidden();
}

/**
 * Ownership check for resources a role may only touch when they own it.
 * This is the guard against IDOR: a `seller` with `listing:update_own` still cannot
 * mutate another seller's listing.
 */
export function requireOwnershipOrPermission(
  session: SessionContext | null,
  ownerId: string | null,
  escalationPermission: Permission,
): asserts session is SessionContext {
  if (!session) throw unauthenticated();
  if (ownerId !== null && ownerId === session.user.id) return;
  if (hasPermission(session.user.role, escalationPermission)) return;
  throw forbidden();
}
