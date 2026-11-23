# 01A — Foundation decisions (ADR-0001)

**Status:** proposed, awaiting tech-lead approval · **Branch:** `feat/bsp-foundation` from `224ad9d` · **Date:** 2026-11-23

Read this before starting any workstream. It records how `01-FOUNDATION-CONTRACTS.md` was applied to
this repository. Where it disagrees with 02–09 on a **name or contract**, this file wins; for **scope**,
the workstream document wins.

---

## 1. Starting point (00 — repository audit)

| Area | State at `224ad9d` |
|---|---|
| Framework | Next.js 15.5 App Router, React 19.2, TypeScript strict (`noUncheckedIndexedAccess`), Tailwind v4 tokens |
| Data | Drizzle 0.38 + Neon serverless driver, 4 migrations, idempotent seed |
| Auth | In-house: Argon2id via `@node-rs/argon2`, SHA-256-hashed DB sessions, HttpOnly + SameSite=Lax cookies (Secure in production), lockout, rate limits, audit rows |
| Validation | Zod 3.25, schemas shared by client and server in `src/lib/validation/` |
| UI kit | In-house `src/components/ui`, Radix Select, CVA, lucide-react. No form library: forms are React state plus the shared Zod schemas |
| Cloudinary | Nothing in code. `CLOUDINARY_URL` was set in `.env.local` but read by nothing |
| Public UI | Landing, `/explore` and `/listings/[slug]` already render **live data server-side** through services. Seed content appears only when `DATABASE_URL` is unset in dev or build |
| Missing | Admin, account area, saved searches, alerts, email, sitemap, JSON-LD, `/banks/[slug]` (linked, 404s), tests, CI |

**Behaviour changed on this branch** — other workstreams build on these:

- Every API response is now the `{ data, error, meta }` envelope (D10). The three existing callers
  (sign-in, sign-up, listing assistant) were moved to `requestApi()` with their copy unchanged.
- `POST /api/auth/sign-out` answered **500 on every call**: it built a 204 with a JSON body, which the
  runtime refuses. It now returns a real 204.
- Dates rendered in the host's timezone. On a UTC server an 11:00 IST auction showed as 05:30. All
  formatting is now pinned to Asia/Kolkata (D6).
- `exploreQuerySchema` and `listingQuestionSchema` moved from `validation/auth.ts` to `validation/listing.ts`.

---

## 2. Decisions

**D1 — One stack, the existing one.** One auth system (the in-house sessions), one ORM (Drizzle), one
validation layer (Zod). No Better Auth or Auth.js: 00 forbids a second auth framework, and the existing
one already covers 03's list. Verification and reset build on the existing `verification_tokens` table.

**D2 — Names follow the repository** (00: "treat route names and tables as proposals").

| Documents say | Code uses |
|---|---|
| property, properties | listing, listings |
| `/api/properties`, `/properties/[slug]` | `/api/listings`, `/listings/[slug]` |
| `locations` | `cities` (with `state`) plus `listings.locality` and `pincode` |
| `property_media` | `listing_images` (Data adds `cloudinary_public_id`) |
| `saved_properties` | `watchlist_items` |
| `admin_audit_logs` | `audit_logs` |
| `PropertySummary`, `PropertyDetail`, `PropertyFilters` | `ListingCard`, `ListingDetail`, `ListingFilters` |
| `Bank`, `Location` | `BankFacet`, `CityFacet` + `LocalityFacet` |
| USER, SUPER_ADMIN | stored as `buyer`, `admin` — exported as `USER_ROLE`, `SUPER_ADMIN_ROLE` |
| `/account/**`, `/admin/**` | kept. `/dashboard` and `/watchlist` become redirects to `/account` (User workstream) |

**D3 — Roles.** USER (`buyer`) and SUPER_ADMIN (`admin`) are the only roles in use. `seller` and
`bank_officer` stay in the enum, unassigned. Sign-up always creates `buyer`. The only path to `admin` is a
provisioning CLI (Auth, 03), audited as `admin.provisioned`. No MVP screen changes roles, and
`user:update_role` stays reserved. Every check goes through `requirePermission`. All permissions the
later workstreams need are already declared in `rbac.ts` (§3).

**D4 — Identifiers.**
- `listings.id` (uuid) is the internal key used by admin URLs and APIs.
- `slug` is the public key: `[a-z0-9-]`, at most 200 characters (`listingSlugSchema`). It is generated
  from title + locality + city, with a numeric suffix on collision.
- The slug is frozen at first publish. A later change writes a redirect row (Data adds
  `listing_slug_redirects`), and the old URL answers 301 (07).
- `reference_no` is the human reference shown in the UI and quoted to banks.

**D5 — Money.** Stored as `bigint` paise (CLAUDE.md). Every contract, API and form uses whole rupees
(`…Inr: number`), and the conversion happens only in repository mappers. Admin inputs are integers.

**D6 — Time.** `timestamptz`, stored as UTC, and ISO-8601 UTC strings in contracts. Display is always
Asia/Kolkata through `src/lib/format.ts` (`DISPLAY_TIME_ZONE`). Admin forms take IST wall-clock input,
and the server converts it to UTC (04). Tests run on a UTC host so this cannot regress unnoticed.

**D7 — Listing lifecycle** (`src/domain/listing-status.ts`). The statuses are `DRAFT`, `PUBLISHED`,
`CLOSED` and `CANCELLED`, with the transitions in `LISTING_TRANSITIONS`. Only `PUBLISHED` is public.
Publishing requires the mandatory fields and a source notice URL (04). A listing whose auction ended
stays `PUBLISHED`. Browse defaults to upcoming and live auctions, and an ended listing's page stays
reachable by URL with an ended state. Stored values map as follows (Data migrates; old values are
never reused):

| Stored today | Contract |
|---|---|
| `draft`, `pending_review` | `DRAFT` |
| `published`, `auction_live` | `PUBLISHED` |
| `expired` | `PUBLISHED` — the auction ended; the listing did not change |
| `sold` | `CLOSED` |
| `withdrawn` | `CANCELLED` |

**D8 — Auctions are events, separate from listings** (`src/domain/auction.ts`).
- One listing has many `AuctionEvent`s. A re-auction is a new event, and history is never overwritten.
- Only cancellation is stored; UPCOMING, LIVE and ENDED come from `deriveAuctionStatus` at read time.
- `selectDisplayAuction` picks the event a page shows.
- Data's migration path:
  1. Add an `auctions` table.
  2. Backfill one event per listing from the current inline columns.
  3. Switch reads to the new table.
  4. Drop the inline columns in a later migration, after verification.

**D9 — Provenance is public; the premium gate is unchanged.**
- `AuctionSource` (`noticeUrl`, `reference`, `lastVerifiedAt`) appears on every published listing,
  together with the disclosure that the bank's notice is authoritative (08).
- Publishing is blocked without `noticeUrl`.
- The existing `listing:view_protected` gate (borrower name, full address, the bank desk's contact,
  the full auction file) stays as it is. See Q1.

**D10 — API envelope** (`src/domain/api.ts`, implemented in `defineRoute`). Handlers return
`respond.ok()`, `respond.paginated()` or `respond.noContent()`. Errors leave only through
`toPublicError`. `meta.requestId` is always present.

| Status | Meaning |
|---|---|
| 400 | Malformed request, or a query string that fails its schema (02) |
| 401 | Signed out, or a machine caller that failed its secret or signature check |
| 403 | Signed in but not permitted, or CSRF failure |
| 404 | Not found, including a route param that fails its schema |
| 409 | Conflict, e.g. a duplicate slug |
| 422 | A body that fails its schema; `fieldErrors` is keyed by field |
| 429 | Rate limited, with `Retry-After` |

Browser code reads responses with `requestApi()` / `readApiResponse()`, which never render a body that
is not our envelope.

**D11 — Pagination.** Page numbers, as `PaginatedResult<T>`, with `MAX_PAGE` 500 and `MAX_PER_PAGE` 50.
On the wire, paging travels in `meta.pagination`.

**D12 — Public and admin-only data are separated.**
- Public DTOs live in `src/domain/*.ts`.
- Admin-only DTOs go in `src/domain/admin/`, and admin services in `src/server/services/admin/`.
- ESLint rejects imports of either from public pages, public features (`home`, `explore`, `listing`)
  and public APIs.
- Public reads always compose `publicScope()`.

**D13 — Pages call services; HTTP is a thin layer over them.** Server Components keep calling services
directly: the output is server-rendered, visible to crawlers, and skips an HTTP hop. The `GET` APIs in
02 wrap the same services for client-side callers.

**D14 — Machine endpoints.**

| Access | Lives under | Authenticated by |
|---|---|---|
| `{ kind: 'cron' }` | `/api/internal/` | `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends GET, so export both GET and POST |
| `{ kind: 'webhook', verify }` | `/api/webhooks/` | `verify`, run over the exact raw body |

Middleware exempts only these two prefixes from its Origin check. Machine routes never read cookies, and
cannot declare a `permission`. The architecture test enforces where they live.

**D15 — Media** (`src/domain/media.ts`).
- Browsers upload directly to Cloudinary, signed by `POST /api/admin/media/sign` (`media:manage`).
- Accepted: JPEG, PNG, WebP or AVIF; at most 10 MB per image and 20 per listing.
- Uploads go to `bank-seal/listings/<listingId>`.
- Before attaching an upload, the server reads its metadata from Cloudinary and deletes anything
  outside the policy.
- Deleting an image or a listing deletes the Cloudinary asset. Uploads still unattached after 24 hours
  are purged by a cron job.
- Images are served only from our own cloud. `next.config.ts` and the CSP are scoped to it, and the
  upload allowance in the CSP exists on `/admin` pages only.

**D16 — Email** (`src/server/email`).
- Every sender uses the `EmailProvider` interface.
- The console provider is the default in dev and test, and logs message bodies in development only.
- SES is built by 06. Production must set `EMAIL_PROVIDER` explicitly.
- Opt-in mail must carry `unsubscribeUrl`, which the type system enforces. Transactional mail is
  always sent.

**D17 — Alert preferences default to off** (05, 06). `users.marketing_opt_in` (from sign-up) must not be
read as consent to digests or reminders. Data decides whether to retire it.

**D18 — Environment.** New names: `CLOUDINARY_URL`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `AWS_REGION`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_CONFIGURATION_SET`, `SES_SNS_TOPIC_ARN`, `CRON_SECRET`,
`GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`. Each one is optional in the schema and
validated by its own accessor (`getCloudinaryConfig`, `getEmailConfig`, `getCronSecret`), so a bad value
breaks its own feature rather than every route. Workers request new names; they don't add them.

**D19 — Testing.**
- Vitest (`npm test`), with tests next to the code as `*.test.ts`.
- `src/test/architecture.test.ts` guards the CLAUDE.md rules that a type checker cannot see.
- QA adds Playwright through a dependency request.
- Vite is pinned to 6.x because Vite 7 needs Node 20.19+ and local Node is 20.9. Node 22 LTS is
  recommended everywhere.

**D20 — Rate limiting is a launch blocker.** The in-process store counts per instance, so on Vercel the
login and reset limits barely work. Auth and QA must register a Redis store via `setRateLimitStore`
before launch; the env names already exist.

---

## 3. Contracts (01 §Contracts)

| 01 asks for | Code type | File |
|---|---|---|
| PropertySummary | `ListingCard` | `src/domain/listing.ts` |
| PropertyDetail | `ListingDetail` | `src/domain/listing.ts` |
| PropertyFilters | `ListingFilters` (`ExploreQuery` implements a subset today) | `src/domain/listing.ts` |
| PaginatedResult\<T\> | `PaginatedResult<T>`, `MAX_PAGE`, `MAX_PER_PAGE` | `src/domain/api.ts` |
| Bank, Location | `BankFacet`; `CityFacet`, `LocalityFacet` | `src/domain/listing.ts` |
| AuctionEvent | `AuctionEvent`, `AuctionSource`, `deriveAuctionStatus`, `selectDisplayAuction` | `src/domain/auction.ts` |
| SavedSearch, NotificationPreference | `SavedSearch`, `SavedSearchFilters`, `NotificationPreference` | `src/domain/account.ts` |
| Property status | `ListingStatus`, `LISTING_TRANSITIONS`, `canTransition` | `src/domain/listing-status.ts` |
| Auction status | `AuctionStatus` | `src/domain/auction.ts` |
| Envelope, validation errors | `ApiResponse<T>`, `ApiErrorBody` | `src/domain/api.ts` |
| Media policy | `LISTING_IMAGE_POLICY`, `MediaSignRequest`, `MediaSignResponse`, `ListingMedia` | `src/domain/media.ts` |
| Email adapter | `EmailProvider`, `EmailMessage` | `src/server/email/types.ts` |
| Permissions | `Permission`, `USER_ROLE`, `SUPER_ADMIN_ROLE` | `src/server/auth/rbac.ts` |

**Data's first deliverable** (00: "backend defines typed contracts and API mocks before frontend workers
start"):
- add `auction: AuctionEvent | null` (via `selectDisplayAuction`) and `auctionHistory: AuctionEvent[]`
  to `ListingDetail`;
- add `auctionStatus: AuctionStatus | null` to `ListingCard`;
- define the admin DTOs in `src/domain/admin/`;
- publish mocks.

UI wiring, SEO and Admin start against those.

---

## 4. Route inventory

**Existing**

| Method | Path | Access | Owner |
|---|---|---|---|
| GET | `/`, `/explore`, `/listings/[slug]`, `/pricing` | public (detail: gated fields by permission) | UI wiring |
| GET | `/sign-in`, `/sign-up` | public | Auth |
| GET | `/dashboard` | session → becomes a redirect to `/account` | User |
| GET | `/robots.txt` | public | SEO |
| POST | `/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/sign-out` | public + CSRF | Auth |
| POST | `/api/listings/ask` | public + CSRF, `listingQuestion` limit | Data |

**Planned pages**

| Path | Access | Owner |
|---|---|---|
| `/verify-email`, `/forgot-password`, `/reset-password` | public, token | Auth |
| `/account`, `/account/saved-properties`, `/account/saved-searches`, `/account/notifications`, `/account/settings` | session | User |
| `/admin`, `/admin/listings`, `/admin/listings/new`, `/admin/listings/[id]/edit`, `/admin/banks`, `/admin/locations`, `/admin/users`, `/admin/notifications` | `admin:access`, plus each action's own permission | Admin |
| `/banks/[slug]`, `/cities/[slug]` (real inventory only), `/sitemap.xml` | public | SEO |
| `/unsubscribe` | public, signed token | Notifications |

**Planned APIs** — every one built with `defineRoute`

| Method | Path | Access | Owner |
|---|---|---|---|
| GET | `/api/listings` (query: `ListingFilters`, paginated) | public, `search` limit | Data |
| GET | `/api/listings/[slug]` (404 unless PUBLISHED) | public | Data |
| GET | `/api/banks`, `/api/locations` | public | Data |
| POST | `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password` | public + CSRF, `emailVerification` / `passwordReset` limits | Auth |
| GET, POST · DELETE | `/api/me/saved-listings` · `/api/me/saved-listings/[listingId]` | `watchlist:manage`, `accountWrite` | Data |
| GET, POST · PATCH, DELETE | `/api/me/saved-searches` · `/api/me/saved-searches/[id]` | `saved_search:manage`, `accountWrite` | Data |
| GET, PATCH | `/api/me/notification-preferences` | `notification_pref:manage` | Data |
| GET, POST · GET, PATCH, DELETE | `/api/admin/listings` · `/api/admin/listings/[id]` | `listing:read_any` / `listing:create` / `listing:update_any` / `listing:delete`, `adminWrite` | Admin |
| POST | `/api/admin/listings/[id]/status` (publish, unpublish, close, cancel, reinstate) | `listing:publish` | Admin |
| POST · PATCH | `/api/admin/listings/[id]/auctions` · `…/auctions/[auctionId]` | `auction:manage` | Admin |
| POST | `/api/admin/media/sign` | `media:manage`, `mediaSign` limit | Admin |
| POST · PATCH, DELETE | `/api/admin/listings/[id]/media` · `…/media/[mediaId]` | `media:manage` | Admin |
| GET, POST, PATCH | `/api/admin/banks[/id]`, `/api/admin/locations[/id]` | `bank:manage`, `location:manage` | Admin |
| GET | `/api/admin/users` | `user:read_any` | Admin |
| GET | `/api/admin/notifications` | `notification:read_any` | Admin |
| GET, POST | `/api/internal/jobs/auction-reminders`, `…/saved-search-digests`, `…/media-cleanup` | cron, `cron` limit | Notifications (media-cleanup: Admin) |
| POST | `/api/webhooks/ses` (SNS signature + `SES_SNS_TOPIC_ARN`) | webhook, `webhook` limit | Notifications |
| POST | `/api/webhooks/unsubscribe` (RFC 8058 one-click; signed token) | webhook | Notifications |

---

## 5. Ownership

A path not listed here belongs to the integration owner. To change a file you don't own, put the
proposed diff under "cross-team requests" in your handoff (10 §"Each worker must submit", item 5), and
its owner applies it.

| Workstream | Owns |
|---|---|
| **0 Integration** | `package.json` and lockfile, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `src/middleware.ts`, `src/app/layout.tsx`, `src/app/{error,not-found}.tsx`, `src/app/globals.css`, `src/lib/**` except `validation/`, `.env.example`, `src/server/api/**`, `src/server/auth/rbac.ts`, `src/server/security/{csrf,crypto,rate-limit,request-context}.ts`, `src/server/services/audit-service.ts`, `src/components/**`, `src/domain/{api,auction,listing-status,media,account}.ts`, `src/test/**`, `CLAUDE.md`, `docs/implementation/**` |
| **1 Data/API** | `src/db/**` (schema, migrations, seed), `src/server/repositories/**`, the read services (`home`, `explore`, `listing-detail`, `listing-qa`, fallbacks, `seed-projection`), `src/server/services/admin/**` (write services for listings, auctions, banks, locations, users), `src/domain/listing.ts`, `src/domain/admin/**`, `src/lib/validation/{listing,admin-*}.ts`, `src/app/api/{listings,banks,locations,me}/**` |
| **1 Auth** | `src/server/auth/{session,current-user}.ts`, `src/server/services/auth-service.ts`, `src/server/security/password.ts` and any new store such as a Redis rate-limit store, `src/app/(auth)/**`, `src/app/api/auth/**`, `src/features/auth/**`, `src/lib/validation/auth.ts`, `scripts/create-admin.ts` |
| **2 Admin** | `src/app/admin/**`, `src/app/api/admin/**`, `src/features/admin/**`, `src/server/media/**` (Cloudinary signing and verification) |
| **2 User** | `src/app/(app)/**` (account pages, `/dashboard` redirect), `src/features/account/**`, including the `SaveButton` that UI wiring places on cards |
| **2 Notifications** | `src/server/email/**` (after this branch), `src/server/jobs/**`, `src/app/api/internal/**`, `src/app/api/webhooks/**`, `src/app/unsubscribe/**`, `vercel.json` |
| **2 SEO** | `src/app/sitemap.ts`, `src/app/robots.ts`, `src/lib/seo/**`, `src/app/{banks,cities}/**`. Metadata and JSON-LD helpers are called by UI wiring; the GA component is mounted in the layout by integration |
| **2 UI wiring** | `src/app/page.tsx`, `src/app/{explore,listings,pricing}/**`, `src/features/{home,explore,listing,pricing}/**` |
| **3 QA** | `e2e/**`, `playwright.config.ts`, `.github/workflows/**`, `docs/deployment/**` |

---

## 6. Seed fixtures (02: "safe demo seed, clearly labelled")

- `npm run db:seed` stays idempotent (upserts keyed on `slug` and `reference_no`), and refuses to run
  when `NODE_ENV=production`.
- Every seeded listing is demo data:
  - `reference_no` starts with `DEMO-`;
  - `noticeUrl` points at `https://example.com/demo-notice/<ref>` (example.com is a reserved domain);
  - descriptions say it is a demonstration listing.
- The seed creates **no users**. Admins are made with the Auth CLI. E2E creates its users through the API.
- Test fixtures (Data) cover:
  - one listing in each status;
  - one published listing with three events (ended, cancelled, upcoming) for 02's "correct next
    auction" test;
  - one undated auction;
  - one re-auction with a revised reserve;
  - two same-title listings in one city, for slug suffixing;
  - reserve prices at the filter boundaries.
- Seeds, migrations and tests run against a Neon development branch, never production (00).

---

## 7. Integration checklist

Every PR:
- [ ] Branched from `main` after this foundation merged; touches only owned paths
- [ ] `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass
- [ ] Routes use `defineRoute`; admin routes declare `permission`; machine routes live under `/api/internal` or `/api/webhooks`
- [ ] Migrations come from `npm run db:generate`, are additive, have reviewed SQL, and have not been run against production
- [ ] New env names and dependencies are requested, not added
- [ ] Security-sensitive writes call `recordAudit` (the `AuditAction` union already lists them)
- [ ] Public UI visually unchanged; screenshots attached for UI changes
- [ ] Handoff covers 10's six points

Merge order (00): foundation → Data → Auth → Admin and User → Notifications, SEO and UI wiring → QA.
Auth and SEO can *start* straight after foundation (the users table and the public services already
exist), but they still merge in this order.

---

## 8. Open questions for the product owner

1. **Premium gate vs the public notice.** The bank's notice usually prints the borrower's name and the
   address. Once its link is public (D9), the gate on those two fields is a convenience, not
   confidentiality. Keep the gate as a paid convenience, or drop it for those fields?
2. **Unused Neon variables.** `NEON_AI_GATEWAY_*` and `NEON_REALTIME_*` are set in `.env.local`, read by
   nothing, and in no workstream. What are they for, or should they be removed?
3. **Stats band.** "70+ Happy Clients" on the homepage has no data source, and 08 forbids mock figures in
   production. Listing and bank counts can be made real; the clients figure needs a source or removal.
4. **Ad slots.** The explore and detail pages show "Advertisement" placeholders, and no ad provider is
   planned in 01–09. Keep them, remove them, or plan a provider?

---

## 9. Traceability — every line of 00 and 01

| Doc · lines | Requirement | Where it is handled |
|---|---|---|
| 00 · 3–8 | Existing state | §1. The public UI is already data-wired, unlike 00's assumption |
| 00 · 10–11 | Audit; report implemented, mocked and conflicting; keep UI; no second ORM or auth; names are proposals; never expose secrets | §1, D1, D2. Env audited by name only |
| 00 · 14 | Branch or worktree per workstream | `feat/bsp-foundation` from `224ad9d` |
| 00 · 15 | 01 merges first | This branch |
| 00 · 16 | Shared files belong to the integration owner | §5 |
| 00 · 17 | Backend contracts and mocks before frontend | §3, Data's first deliverable |
| 00 · 18 | Small PR with full handoff | PR description |
| 00 · 19 | No production migrations, bulk email or production data | None run; console email provider; §6 |
| 00 · 20 | Merge order | §7 |
| 00 · 22–29 | Definition of done | QA (09). Foundation supplies the envelope, permission guards, env names and the test harness |
| 01 · 5 | Identify the current stack | §1 |
| 01 · 6 | One auth, one ORM, one validation layer | D1 |
| 01 · 7 | Roles USER and SUPER_ADMIN; no self-service admin | D3, `rbac.ts` |
| 01 · 8 | ID, slug, price units, UTC storage, IST display, lifecycle | D4–D7; `format.ts` fix |
| 01 · 11 | The contract list | §3 |
| 01 · 12 | Property status and derived auction status | `listing-status.ts`, `auction.ts` |
| 01 · 13 | Envelope, structured validation errors, consistent pagination | D10, D11; `route-handler.ts`, `api-response.ts` |
| 01 · 14 | Public vs admin-only fields separated; nothing private from public endpoints | D12; ESLint boundary; `publicScope()` |
| 01 · 16–20 | Proposed endpoints | §4 |
| 01 · 23 | Zod on all input; parameterised queries; server-side role checks | `defineRoute` `params` / `query` / `schema`; Drizzle only; `permission` + architecture test |
| 01 · 24 | Server-only DB and service code; no secrets client-side | `server-only` guard test; split server and client env |
| 01 · 25 | Central env validation; `.env.example` placeholders only | D18 |
| 01 · 26 | Cloudinary signed uploads; MIME, size, access; retention and deletion | D15; `media.ts`; `next.config.ts` and CSP scoped |
| 01 · 27 | Service and repository modules; no DB in components | Existing ESLint layering rule plus D12 |
| 01 · 30 | Deliverables: ADR, route inventory, contracts, auth/ORM decision, ownership, seed spec, checklist | This file |
| 01 · 32 | Workers compile against types and know their files | `npm run typecheck` passes with the contracts in place; §5 |
