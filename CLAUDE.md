# Bank Seal — working notes

Bank auction marketplace. Next.js 15 App Router, TypeScript strict, Tailwind v4,
Drizzle + Neon PostgreSQL. Treat this as a production security-sensitive application,
not a prototype.

## Commands

```bash
npm run dev            # dev server
npm run typecheck      # tsc --noEmit — run before claiming a change works
npm run lint
npm test               # vitest: unit tests + architecture guards (src/test/)
npm run build          # fails on type or lint errors by design
npm run db:generate    # after ANY schema change
npm run db:seed        # idempotent
```

## Non-negotiables

- **Never bypass `defineRoute`.** Every API route goes through
  `src/server/api/route-handler.ts`, which applies CSRF, rate limiting, body limits,
  schema validation, permission checks and safe error serialisation. A handwritten
  handler silently drops all of it, and fails `npm test`.
  - Every response is the `{ data, error, meta }` envelope: return `respond.ok()`,
    `respond.paginated()` or `respond.noContent()`. Browser code reads it with
    `requestApi()` from `src/lib/csrf-client.ts`.
  - Validate input through the options: `params` (fails → 404), `query` (→ 400),
    `schema` for the body (→ 422).
  - Server-to-server callers use `access: { kind: 'cron' }` under `/api/internal/` or
    `access: { kind: 'webhook', verify }` under `/api/webhooks/` — the only paths
    middleware admits without an `Origin` header.
- **Never check roles inline.** Use `requirePermission(session, '<permission>')`.
  Add new permissions to the `Permission` union and `ROLE_PERMISSIONS` in
  `src/server/auth/rbac.ts`. `if (user.role === 'admin')` is a bug. The product's two
  roles, USER and SUPER_ADMIN, are stored as `buyer` and `admin`.
- **Admin-only DTOs live in `src/domain/admin/`, admin services in
  `src/server/services/admin/`.** ESLint stops public pages, features and APIs from
  importing either.
- **Public listing queries must compose `publicScope()`** from
  `src/server/repositories/listing-repository.ts`. It is what stops a draft or withdrawn
  listing being reachable by guessing an id.
- **Validate on the server, always.** Client-side Zod is for feedback only. Both sides
  share the schemas in `src/lib/validation/`.
- **Money is `bigint` paise** in the database, converted to rupees only at the DTO
  boundary. Never store a float.
- **Times are stored UTC and shown in Asia/Kolkata.** Format through `src/lib/format.ts`,
  never `toLocale*` at a call site — the host's zone is UTC in production.
- **An auction's state is derived, not stored.** Use `deriveAuctionStatus` from
  `src/domain/auction.ts`. ENDED means the clock ran out, never that the asset sold.
- **No raw hex in components.** Add a token to `@theme` in `src/app/globals.css`.
- **Type and spacing come from the scale, not from the call site.** Both live in
  `@theme` and both are fluid, interpolating between a 375px and a 1280px viewport, so
  a layout adapts without a `sm:`/`lg:` ladder per element.
  - Headings: `text-hero` → `text-h5`. Never `text-2xl sm:text-3xl lg:text-[2.5rem]`.
  - Reading sizes are fixed and do not shrink on a phone: `text-body` (15px) and
    `text-meta` (13px) fill the gaps Tailwind's scale leaves.
  - Rhythm: `section-lg` > `section` > `block` > `card` > `gap`, as `py-section`,
    `mt-block`, `p-card`, `gap-gap`. `px-gutter` is the page column's padding.
  - Controls: `h-control` (44px tapped → 40px clicked), `h-control-sm`, `h-control-lg`.
    These run the opposite way to the type scale. Let `Button`, `Input` and `Chip`
    apply them; do not restate a height at the call site.
  - Tailwind's numeric scale is still right for small fixed values — the gap inside a
    row, the space between a label and its field.
- **New `--text-*` or `--spacing-*` tokens must also be listed in `src/lib/cn.ts`.**
  tailwind-merge cannot read the theme: an unregistered `text-*` is taken for a colour
  and silently dropped, and an unregistered spacing class stops conflicting with the
  utility it is meant to override.
- **Dropdowns/menus go through `src/components/ui/select.tsx`** (Radix Select, styled
  with our tokens). Don't hand-roll a listbox — typeahead, roving focus and collision
  positioning are why the library is there. Compose it like `category-select.tsx`.
- **UI never imports `@/db/*` or a repository.** Fetch in a page/route handler and pass
  props down. ESLint enforces this for `src/components/**` and `src/features/**`.
- **Every server module starts with `import 'server-only'`.**
- **Errors leave through `toPublicError`.** Never return a driver message, stack or
  internal id to a client.
- **Audit security-sensitive actions** with `recordAudit`. Auth events, role changes,
  publishes and administrative mutations all qualify.

## Workstreams

Feature work follows `docs/implementation/`. Read `01A-FOUNDATION-ADR.md` first: it fixes
names (the docs' "property" is this code's "listing"), contracts, the route inventory and
which workstream owns which files.

## Conventions

- Comments explain *why*, not *what*. The security modules carry the reasoning behind
  each decision — keep that standard when editing them.
- DTOs in `src/domain/` are deliberately narrower than table rows. Widen them
  consciously, never by spreading a row.
- Prefer native platform behaviour over JS: the rails use scroll-snap, the hero search
  is a plain GET form that works without JavaScript.
- Accessibility is part of "done": labelled controls, `aria-live` on async feedback,
  visible focus, and the ARIA tabs pattern where tabs are used.

## Known follow-ups

- Rate-limit store is in-process; swap for Redis via `setRateLimitStore` before
  launch. On Vercel every instance counts separately, so auth limits barely bite.
- Email verification and password reset are scaffolded (`verification_tokens` table)
  but not built. Send through `getEmailProvider()` in `src/server/email` — it logs in
  development; SES arrives with workstream 06.
- Denormalised counters (`cities.listing_count`, `banks.listing_count`) are refreshed by
  the seed only — they need a scheduled job.
- `/banks/[slug]` is linked from the homepage and the detail page but not yet built.
  The user menu's `/watchlist` link 404s until `/account` exists.
