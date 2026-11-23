# Workstream A — Neon Database, Domain Logic, Public APIs
**Depends:** 01. **Own:** DB migrations/schema, repositories, property/auction service, public read APIs. **Avoid:** UI, auth UI, root layout.

## Data model
- `users` and auth-specific tables per chosen auth provider; `banks`; `locations` (normalized city/state + optional locality/PIN).
- `properties`: id, slug unique, title, type, address, location_id, description, area_value/unit, possession_type, status, created_by, published_at, updated_at.
- `auctions`: id, property_id, bank_id, reserve_price_inr (integer), emd_inr, start_at, end_at, emd_deadline_at, status, source_notice_url, last_verified_at, source_reference, contact_public.
- `property_media`: property_id, cloudinary_public_id, secure_url, resource_type, alt_text, sort_order.
- `saved_properties` unique(user_id,property_id); `saved_searches`; `notification_preferences`; `notification_deliveries` unique idempotency key; `admin_audit_logs`.
- Optional `source_documents` and `property_view_daily` for source provenance/analytics.
- Property and auction separate: one property may have many auction events; designate next/current auction for display.

## DB implementation
- Migrations are additive and reversible where practical; foreign keys, cascading behavior explicitly reviewed.
- Index published+location, published+type, auction date/status, reserve price, slug; full-text search only if needed by current UI.
- Safe demo seed: sample data clearly labeled, never fabricated as real auctions on public production pages.

## APIs
- `GET /api/properties?q=&city=&state=&bank=&type=&minPrice=&maxPrice=&status=&sort=&page=&limit=`: return only published and eligible public data; validate params; cap page size; avoid N+1.
- `GET /api/properties/[slug]`: published property with public bank, media, active/most recent auction, source link; return 404 for unpublished.
- `GET /api/banks`, `GET /api/locations`: public filter data.
- Admin CRUD in isolated server service with create/update/publish/unpublish, unique slug handling, transaction boundaries, audit logs; handlers coordinated with admin owner.

## Important domain behavior
- Scheduled auction status transition must not silently imply a property has sold. Keep expired vs closed vs cancelled distinct.
- Preserve auction history when reserve prices or dates change; do not overwrite prior events.
- Do not treat unverified external data as authoritative. Show original notice and verification date.

## Tests and acceptance
- Migration applies to empty DB; duplicate slugs handled; pagination and filters correct; unpublished content inaccessible; property with multiple auctions renders correct next auction; query validation returns 400; API contract tests pass.
