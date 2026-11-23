# Workstream F — Technical SEO and Discoverability
**Depends:** 01 routes/contracts and 02 public data APIs. **Own:** SEO metadata utilities, sitemap/robots, schema markup, SEO route pages. **Avoid:** redesigning existing landing/list/detail UI.

## Existing UI integration requirements
- Existing landing/list/detail pages remain visually intact; ensure content needed for indexing is rendered server-side (not only client-side after hydration).
- Dynamic title/description/canonical for each published property; Open Graph/Twitter previews.
- Property slugs stable; 301 redirects on slug change; 404 or 410 for removed pages as appropriate.
- Include bank, city, property type, reserve price and auction date in human-readable page content when verified.

## Indexation rules
- `sitemap.ts`: only published, canonical, useful pages; split sitemap if needed; accurate lastModified.
- `robots.ts`: exclude account/admin/auth/internal API routes; do not mistake robots blocking for authorization.
- `noindex` empty search combinations, account/admin, filtered URL duplicates, draft/cancelled pages as policy dictates.
- City and bank landing pages only if they have useful original content and real inventory; avoid mass thin programmatic SEO.
- Add breadcrumbs and valid JSON-LD schema supported by Google; do not invent ratings, offers, ownership or guarantees.
- Internal links from homepage → city/bank pages → property detail and related properties.

## Performance and analytics
- Optimize Cloudinary images, image alt text, responsive sizes; limit client JS; caching and revalidation after admin publish.
- Configure GA4 events: `view_property`, `search`, `filter_apply`, `save_property`, `register`, `alert_opt_in`, `source_notice_click`; never send sensitive user data to analytics.
- Search Console verification, sitemap submission checklist, 404 monitoring, Core Web Vitals checks.

## Acceptance
Server-rendered published page HTML contains content and metadata; draft URL not indexed; canonical/sitemap URLs correct; JSON-LD validates; no duplicate titles from query parameters; production robots does not accidentally disallow public pages.
