# Bank Seal Property — Claude Code Execution Guide

## Existing state (do not rebuild)
- Landing page UI exists.
- Property listing page UI exists.
- Property detail page UI exists.
- User dashboard, Super Admin dashboard, backend integration, SEO logic and notifications remain incomplete.
- Intended stack: Next.js App Router + TypeScript, Next.js Route Handlers, Neon PostgreSQL, Cloudinary, AWS SES.

## Mandatory first step: repository audit
Inspect `package.json`, `src/app` or `app`, existing components, auth setup, data fetching, database schema, migrations, environment variables (names only), deployment configuration, tests, and existing design patterns. Report what is implemented, what is mocked, and what conflicts with this plan. **Do not overwrite working UI or choose a second ORM/auth framework if one already exists.** Treat route names and tables below as proposals, adapt to repository conventions. Never expose secrets.

## Parallel work protocol
1. Create one Git branch/worktree per workstream from the same baseline.
2. Complete **01-FOUNDATION-CONTRACTS.md** first and merge it before independent work begins.
3. Each worker owns only its designated files and modules; shared files (`package.json`, root layout, global middleware, DB barrel/schema exports) are changed only by the integration owner.
4. Backend worker defines typed contracts and API mocks before frontend workers start; frontend workers can build against those contracts.
5. Each worker submits a small PR with files changed, migrations, environment additions, tests, screenshots where UI changes, and unresolved issues.
6. Do not run production migrations, send real bulk email, or modify production data without explicit approval.
7. Merge order: foundation → backend → auth → admin/user → notifications/SEO → QA; admin/user and notifications/SEO can proceed in parallel once interfaces stabilize.

## Definition of done
- Existing three public UIs visually unchanged except approved data/error/loading states.
- End-to-end property publish → public listing → detail page works.
- Users can register, verify, sign in, save a property, manage alerts.
- Admin permissions enforced server-side for every write operation.
- SEO pages have canonical metadata, crawlable server-rendered content and valid sitemap.
- Tests, lint, typecheck, build and accessibility checks pass.
- No secrets committed; production environment checklist completed.

## Documents
01 foundation/contracts; 02 DB/API; 03 auth; 04 Super Admin; 05 user dashboard; 06 notifications; 07 SEO; 08 existing UI integration; 09 QA/deployment; 10 parallel tracker.

## Paste this into Claude Code first
> Read `docs/implementation/00-START-HERE.md` and `01-FOUNDATION-CONTRACTS.md`. Audit the existing repository and summarize existing vs missing functionality. Do not code until you propose a concrete file ownership plan, dependencies, and any conflicts with the current stack. Preserve the existing landing, listing, and detail UI. Implement only the workstream document I assign, with tests and a concise handoff report.
