# Workstream G — Wire Existing Landing, Listing and Detail UI
**Depends:** 01 contracts and 02 public APIs. **Own:** minimal adapters/hooks/server loaders within existing public routes; coordinate ownership with SEO worker. **Avoid:** component redesign, CSS refactor, replacing layout.

## First inspect
Locate exact landing, listing, and detail routes; list current hardcoded arrays, mocks, placeholder images, filters and state management. Document component props and current URL query conventions.

## Landing
Replace mock featured/recent/upcoming properties and bank/city counts with real published data. Keep design; add meaningful empty states when inventory is low.

## Listing
Connect existing filter UI to validated URL query parameters and `GET /api/properties`/server service. Pagination, sort, bank, city, type, price, upcoming status. Ensure back/forward navigation and shareable URLs. Avoid client-side fetching as the sole source of SEO-visible listing content.

## Detail
Resolve by stable slug; fetch published property, media, auction, bank and source notice. Format INR and IST. Show source link, last-verified date, and disclosure that bank notice is authoritative. Add save action behind login. Handle draft/missing/expired/cancelled gracefully.

## Acceptance
Pixel-level layout substantially preserved; no mock listings on production; filters are functional and URL-backed; correct 404; admin publish reflected on site via cache invalidation; mobile layout remains intact.
