# Login CAPTCHA handoff — 2026-09-16

## State

- PR #1939 is **IMPLEMENTED** on branch `security/login-image-captcha` and is not merged.
- The portal login now includes a traditional distorted image CAPTCHA directly below the Password field.
- CAPTCHA challenges are generated and verified server-side through `/api/auth/captcha`.
- Challenge answers are not returned to the browser; the browser receives a short-lived HMAC-signed challenge token plus the rendered SVG image.
- Challenges expire after 2 minutes and are refreshed after invalid/expired CAPTCHA attempts or failed sign-in attempts.
- Existing Supabase password authentication, role/profile checks, secure browser-session creation, redirects, and forgot-password behavior remain unchanged.
- No database, schema, RPC, RLS, or permission changes are included.

## Production prerequisite

Configure server-only `LOGIN_CAPTCHA_SECRET` with at least 32 random characters before production deployment. Do not prefix it with `NEXT_PUBLIC_`. If the secret is absent or invalid, CAPTCHA generation intentionally fails closed and login cannot proceed.

## Files

- `apps/web-portal/components/login-form.tsx`
- `apps/web-portal/app/api/auth/captcha/route.ts`
- `apps/web-portal/lib/login-captcha.ts`
- `apps/web-portal/.env.example`
