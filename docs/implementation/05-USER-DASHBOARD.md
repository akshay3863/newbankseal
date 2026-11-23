# Workstream D — User Account and Saved Listings
**Depends:** 01, 02 saved-item APIs, 03 authentication. **Own:** `app/account/**`, user dashboard components/hooks. **Avoid:** admin screens, schema migrations.

## Pages
- `/account`: summary of saved properties, next auctions and alert status.
- `/account/saved-properties`: cards reusing existing property components, remove bookmark, empty state.
- `/account/saved-searches`: create/edit/delete filters (city, state, bank, type, min/max reserve, auction timing); frequency daily/weekly.
- `/account/notifications`: manage opt-in and alert settings, link to unsubscribe.
- `/account/settings`: name, email display, security links, account deletion request pathway.

## UX and behavior
- Public property cards/details show Save button; anonymous click prompts login and returns to same property after auth.
- Saved items are per-user and de-duplicated. Never reveal other users' saved searches.
- Use server-rendered initial data where useful; accessible loading/error/empty states; optimistic update only with rollback.
- Email opt-in is explicit and off by default for marketing-style new listing alerts; transactional reminders follow clear user preferences.

## Acceptance
Registration → login → save from existing listing/detail → dashboard → remove works; saved-search filters persist; preferences are respected; mobile responsive; authorization tests pass.
