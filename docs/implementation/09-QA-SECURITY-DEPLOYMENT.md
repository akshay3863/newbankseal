# Workstream H — QA, Release and Production Readiness
**Depends:** all merged features. **Own:** integration tests, E2E tests, deployment docs, CI; avoid large feature rewrites.

## Automated tests
- Unit: validation, auction date status, saved-search matching, notification idempotency.
- Integration: public property queries, admin CRUD authorization, save/unsave, notification preferences, source provenance.
- E2E: admin publish → public detail; user register/verify/login → save → alert preferences; SEO sitemap; logout.
- CI: install, lint, typecheck, unit tests, build, E2E smoke tests where feasible.

## Security and reliability
- No server secrets in browser bundle, no public admin APIs, role escalation tests, file MIME/size checks, auth rate limits, XSS/CSRF/SQLi controls.
- DB backups/restore test, migration rollback plan, log redaction, error monitoring, upload limits, request limits.
- Cloudinary and SES usage limits, domain verification, webhook signatures, cron protection, no bulk production email on deploy.

## Deployment checklist
- Vercel envs for preview and production; Neon separate dev/staging/prod databases; Cloudinary credentials; SES domain and verified sender; cron secret; auth secrets.
- Run migrations deliberately and review before production; smoke test key pages and email in controlled test mode.
- GA4/Search Console, robots/sitemap, canonical host, custom 404, cache invalidation, privacy/terms, uptime/error alerts.

## Acceptance
No critical issues, CI green, documented env variables and rollback, verified auth and admin permissions, production smoke tests pass.
