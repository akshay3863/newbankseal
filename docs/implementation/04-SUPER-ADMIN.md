# Workstream C — Super Admin Dashboard
**Depends:** 01, 02 APIs and 03 guards. **Own:** `app/admin/**`, admin components and admin-specific hooks. **Avoid:** shared DB schema and public landing/listing/detail components.

## Pages
- `/admin`: KPI cards (published, draft, upcoming, expired), latest activity; only real DB values.
- `/admin/properties`: table with search/filter/status, pagination, bulk publish/unpublish if safe.
- `/admin/properties/new` and `/admin/properties/[id]/edit`: form with draft autosave optional.
- `/admin/banks`: manage institution names/slugs/logos; `/admin/locations`: manage cities/states.
- `/admin/users`: read/search users, status, registered date; no arbitrary password viewing or impersonation.
- `/admin/notifications`: preview and inspect delivery logs, not uncontrolled mass email.

## Property form
Title, type, description, state/city/locality/PIN/address, area and unit, bank, reserve INR, EMD INR, auction date/time and deadline, possession type, public source URL, contact info, media, source verification timestamp, draft/published status.
- Field-level Zod validation, error display, duplicate checks, preview, image ordering and deletion.
- Date/time entered as IST, converted to UTC for storage; display IST consistently.
- Publishing blocked for missing mandatory details/source link; confirm destructive actions.
- Cloudinary signed uploads; file restrictions, previews, cleanup orphaned files.
- CSV import is a **separate optional enhancement**, not a blocker for MVP.

## Acceptance
Admin can create draft, upload images, publish, edit, unpublish; public UI updates correctly; permissions enforced by API; invalid forms display actionable errors; audit trail recorded; mobile/tablet usable.
