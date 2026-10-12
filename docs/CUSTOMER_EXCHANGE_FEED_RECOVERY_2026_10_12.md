# Customer Exchange recoverable feed failure — 2026-10-12

## Symptom
The Cloudflare-hosted Customer Web `/customer/exchange` displayed the global "This page could not finish loading" screen. Global Try again invokes Next.js error boundary `reset()`, and Reload page invokes a full browser reload. Persistent route/data failures recur after either action.

## Code findings (not live-production root-cause proof)
Customer Exchange server page calls `resolveCustomerWebScope` followed by `loadCustomerExchangeFeed`. The latter calls `exchange_marketplace_feed` with the authenticated Supabase server client and throws a generic error on RPC failure. The precise triggering production error (RPC, customer session, or another failure) has not been confirmed from Cloudflare/Supabase logs.

## Change scope
The page handles only Exchange feed-loading failures, showing an accessible, route-local recovery panel and leaving Customer layout and navigation available. Retry uses a standard GET form to force a fresh server request, preserving account, category and search filters. Back to dashboard provides an escape route. Account/session authorization runs outside the catch and is not masked. A sanitized server log records the feed failure category. No database, schema, RLS, keys, auth, mobile app or deployment changes.

## Verification and rollout
`apps/web-portal/scripts/customer-exchange-recovery-regression.mjs` checks auth boundary, local recovery, repeatable GET retry, filter retention and escape navigation; wired to Verify web portal CI. Await passing CI, real authenticated browser checks and platform logs. This prevents a generic error screen for feed RPC failures but cannot repair a missing/invalid production RPC, permissions, networking, or failures outside this feed call.

## Reversibility
Revert the PR's page, test and workflow changes; no database rollback. Do not merge or deploy Cloudflare/Vercel until user approval.
