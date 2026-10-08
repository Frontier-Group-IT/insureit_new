# Phase 2A: public portal browser reliability

Stacked on draft PR #2983; this follow-up must merge **after** #2983 only if both are approved. The base branch is `test/playwright-readonly-smoke-2026-10-08`.

Added `specs/public-reliability.spec.ts`:
- Three sequential GET navigations to public login; form remains visible
- Mobile/desktop viewport dimensions captured in Playwright report annotations
- Uncaught JavaScript page errors during initial client hydration

All checks run in both desktop and mobile Chromium configurations from PR #2983.

**Limits:** tests do not authenticate, submit forms, fetch private records intentionally, simulate native Expo apps, validate authorization/RLS, run attacks, or establish performance/uptime service levels. Layout measurements are informational, not a visual-regression verdict. Use real devices and synthetic accounts for later phases. Production must not receive write traffic.

**Release guard:** no Vercel deployment, native build, OTA, migration, production data mutation, or merging authorized here. Run the existing isolated Playwright workflow on the stacked PR, review evidence, then request explicit approval before merge.
