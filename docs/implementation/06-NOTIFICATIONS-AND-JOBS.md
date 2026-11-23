# Workstream E — AWS SES, Alerts and Scheduled Jobs
**Depends:** 01 contracts, 02 schema, 03 user identity. **Own:** email adapter/templates, alert matching, scheduled jobs, delivery logs. **Avoid:** admin/user page layout.

## MVP events
1. Email verification and password reset (transactional, auth provider integration).
2. New published listing digest matching saved search (daily; optional weekly).
3. Auction reminder 24h before start for saved properties, if opted in.
4. Optional in-app notification list only if agreed; email-first MVP.

## Architecture
- Server-only SES client with verified sender domain; environment names in `.env.example`.
- Cron endpoint protected by secret and/or platform auth, cannot be called anonymously.
- Job selects eligible recipients in batches, checks preference/consent, writes pending delivery row with unique `(user,event,auction-or-digest-window)` key, sends, records provider message ID and outcome.
- Retries transient failures with backoff, no duplicate sends; cap daily volume and implement throttling.
- Process SES bounce/complaint events via validated provider webhook/SNS integration where configured; suppress affected addresses.
- Include unsubscribe link for optional digests; one-click unsubscribe if appropriate; transaction emails remain separate.
- Date logic uses UTC storage and Asia/Kolkata for user-visible times.

## Safety
Never send real emails during local tests; use stubbed provider. No mass email to scraped addresses. SES production access, SPF/DKIM/DMARC, privacy/consent and rate limits must be verified before enabling.

## Acceptance
Matching filters correctly select users; duplicate cron invocation does not double send; unsubscribed users excluded; expired/cancelled auctions not reminded; failed send can retry; test templates render correctly.
