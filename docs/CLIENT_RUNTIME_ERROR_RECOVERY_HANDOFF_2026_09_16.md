# Client Runtime Error Recovery — 2026-09-16

## State

**IMPLEMENTED in PR #1912; not merged or deployed.**

## Problem

Production users intermittently received the generic Next.js client-side application error screen while loading or navigating portal pages. Vercel server runtime errors also showed route-specific failures on Partner Network and Partner Account Registration, but server logs did not identify the browser-side exception responsible for the generic client crash screen.

## Implementation

- `app/error.tsx` adds a route-level recovery boundary with **Try again** and **Reload page** actions.
- `app/global-error.tsx` replaces the generic fatal Next.js screen for root-level render failures with a controlled recovery screen.
- `components/client-runtime-error-monitor.tsx` records browser `error` and `unhandledrejection` events and reports boundary failures.
- `app/api/client-runtime-errors/route.ts` writes privacy-safe diagnostic events to platform runtime logs with deployment SHA.
- `app/layout.tsx` mounts the global monitor alongside existing non-visual route enhancements.

## Privacy and safety rules

- Do not send query strings, cookies, access tokens, session payloads, customer data or form values.
- Only pathname, error name/message/stack/digest, source and deployment SHA are recorded.
- Client reports are deduplicated for 30 seconds.
- Telemetry failures are swallowed and must never cause a new user-facing failure.
- No automatic reload loop is implemented.
- No database, Supabase schema, RLS, RPC, authentication or business workflow changes are included.

## Verification

Canonical `Verify web portal` run for the final PR head must pass before merge. After production deployment, use Vercel runtime logs filtered for `[client-runtime-error]` to identify the exact recurring browser exception before making any root-cause business/session/navigation changes.
