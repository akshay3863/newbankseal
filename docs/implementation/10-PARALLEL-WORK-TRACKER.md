# Parallel Implementation Tracker

## Recommended order and ownership
| Phase | Workstream | Prerequisite | Parallel with | Branch suggestion |
|---|---|---|---|---|
| 0 | Foundation/contracts | Audit | None | `feat/bsp-foundation` |
| 1 | Database/API | Foundation | Auth after schema contracts | `feat/bsp-data-api` |
| 1 | Auth/security | Foundation + user schema contract | Data/API | `feat/bsp-auth` |
| 2 | Admin | CRUD contracts + auth guards | User dashboard, notifications, SEO | `feat/bsp-admin` |
| 2 | User dashboard | Saved-item contracts + auth | Admin, notifications, SEO | `feat/bsp-user` |
| 2 | Notifications | Preferences schema | Admin, user, SEO | `feat/bsp-alerts` |
| 2 | SEO | Public routes/data contract | Admin, user, notifications | `feat/bsp-seo` |
| 2 | Existing UI wiring | Public data contract | Admin, user; coordinate SEO files | `feat/bsp-public-wireup` |
| 3 | QA/deploy | Merged work | None | `feat/bsp-release` |

## Shared file ownership
- DB schema/migrations: **Data/API owner only**; other workers propose changes in handoff notes.
- `package.json`, lockfile, `next.config`, root layout, env schema, auth middleware: **integration owner only**.
- Public route files: **UI wiring owner**; SEO owner supplies metadata helpers and change requests, not competing edits.
- Auth config and guards: **Auth owner**.
- Email adapter and cron: **Notifications owner**; auth owner consumes adapter via contract.

## Each worker must submit
1. Summary and changed files.
2. API/type changes and migration needs.
3. Commands/tests run and results.
4. Manual QA steps.
5. Remaining blockers and cross-team requests.
6. Confirmation existing UI was preserved.

## Claude Code workstream prompt template
> Read `docs/implementation/00-START-HERE.md`, `01-FOUNDATION-CONTRACTS.md`, `01A-FOUNDATION-ADR.md`, and `docs/implementation/<WORKSTREAM>.md`. Inspect the actual repository. You own only this workstream. First identify exact files you plan to modify, dependencies and missing interfaces. Then implement in small commits, preserve existing landing/listing/detail UI, add tests, run lint/typecheck/build as available, and produce the six-point handoff report. Do not touch files assigned to another worker or invent missing credentials; request a contract change instead.

## Progress board
- [ ] Audit + contracts approved
- [ ] Schema and migrations merged
- [ ] Public APIs merged
- [ ] Auth merged
- [ ] Admin merged
- [ ] User dashboard merged
- [ ] Notifications merged
- [ ] SEO merged
- [ ] Existing UI integrated
- [ ] E2E, security and deployment complete
