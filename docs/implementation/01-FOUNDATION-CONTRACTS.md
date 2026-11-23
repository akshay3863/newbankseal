# Workstream 0 — Foundation and Shared Contracts
**Owner:** integration/technical lead. **Must finish before parallel feature branches.**

## Audit and decisions
- Identify current Next.js version, routing, auth, ORM, form library, UI kit, Cloudinary integration and existing types.
- Confirm one auth solution (prefer existing; otherwise Better Auth or Auth.js), one ORM (prefer existing; otherwise Drizzle), one validation layer (Zod).
- Define permission roles `USER`, `SUPER_ADMIN`; no self-service admin assignment.
- Decide canonical property ID, stable slug policy, price units (integer INR), date storage (UTC), display timezone (Asia/Kolkata), listing lifecycle.

## Contracts
- `PropertySummary`, `PropertyDetail`, `PropertyFilters`, `PaginatedResult<T>`, `Bank`, `Location`, `AuctionEvent`, `SavedSearch`, `NotificationPreference`.
- Property status `DRAFT | PUBLISHED | CLOSED | CANCELLED`; auction status `UPCOMING | LIVE | ENDED | CANCELLED` (derive from schedule where appropriate).
- API response envelope `{data, error, meta}` and structured validation errors; cursor or page pagination consistently.
- Public fields vs admin-only fields explicitly separated. Never return private user info, unpublished listings, or internal notes from public endpoints.

## Proposed API endpoints (adapt to existing routes)
- `GET /api/properties`, `GET /api/properties/[slug]`, `GET /api/banks`, `GET /api/locations`
- `POST/PATCH/DELETE /api/admin/properties`, `POST /api/admin/media/sign`, `GET /api/admin/users`
- `GET/POST/DELETE /api/me/saved-properties`, `GET/POST/PATCH/DELETE /api/me/saved-searches`, `GET/PATCH /api/me/notification-preferences`
- `POST /api/internal/jobs/auction-reminders` (secured scheduler only)

## Cross-cutting rules
- Validate all untrusted input with Zod. Parameterized ORM queries. Server-side role checks in every admin handler.
- DB and service code server-only; no Neon credentials or SES keys in client bundles.
- Centralize env validation; add `.env.example` with placeholders only.
- Cloudinary uploads signed server-side; limit MIME, size and access; document retention and deletion.
- Prefer service modules and repository functions, no DB queries scattered across React components.

## Deliverables
Architecture decision record, route inventory, TypeScript contracts, auth/ORM decision, ownership boundaries, seed fixture spec, integration checklist.
## Acceptance
Other workers can compile against types and know which files they may edit without collisions.
