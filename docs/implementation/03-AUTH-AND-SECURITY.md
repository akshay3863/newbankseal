# Workstream B — Authentication, Authorization, Account Security
**Depends:** 01 and user schema from 02. **Own:** auth provider setup, login/register/reset/verify flows, server auth guards. **Avoid:** property UI and admin feature screens.

## Features
- Register with email/password, verify email, login/logout, forgot/reset password, session management.
- Optional Google login only if already integrated or explicitly approved; not needed for MVP.
- User profile basic fields (name/email), secure password change if supported.
- Roles `USER` and `SUPER_ADMIN`; provision first admin by a protected one-time CLI/seed operation, not a public route.
- Protect `/account/**`, `/admin/**` in server layouts and enforce auth+role again in each API/service write.

## Security
- Passwords handled by trusted auth library, no custom hashing implementation unless required.
- HttpOnly Secure SameSite cookies, CSRF protection where relevant, session expiry/revocation.
- Rate limit login, signup, password reset and email verification; generic error messages for account existence.
- Never trust role/userId passed from client; derive identity from server session.
- Validate redirect targets to avoid open redirects; sanitize and encode output.
- Record admin actions; avoid storing passwords/tokens in logs.

## Email events
- Registration verification and password reset via shared email adapter; no production SES sending in tests.

## Acceptance
- User cannot access admin screens/APIs; anonymous users cannot access saved items; user cannot read/update another account; verification and reset tokens expire; logout invalidates session; route and API authorization tests pass.
