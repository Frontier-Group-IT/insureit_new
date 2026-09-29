# Accounts Reconciliation Work Queue Refresh Fix — 2026-09-29

## Problem observed in production

The `/accounts` Reconciliation work queue was visibly refreshing/flickering and replacing rows repeatedly while the lower Accounts Dashboard remained comparatively stable.

## Verified root cause

The Phase 4 work queue component replaced the browser-global `window.history.replaceState` function on mount. Every Accounts dashboard URL update therefore emitted a custom `insureit:accounts-url-change` event. The work queue listened for that event and independently called `loadAccountsSnapshotAction(...)`.

This created an unnecessary second refresh path on top of the Accounts Dashboard's own snapshot loading. Framework/history updates could retrigger the patched function, which made the queue appear to refresh continuously and could temporarily show a different snapshot from the lower dashboard.

## Fix

Branch: `fix/accounts-work-queue-refresh-loop`

The work queue no longer patches or replaces `window.history.replaceState` and no longer installs a global custom URL-change event.

Instead it:

- observes the normal Next.js URL search parameters with `useSearchParams()`;
- keeps the server-rendered rows for the initial view without issuing a duplicate initial request;
- performs one scoped queue refresh only when the Accounts URL-backed filter state actually changes;
- keeps a request sequence guard so an older request cannot replace a newer filter result;
- cancels state application when the effect is superseded/unmounted;
- correctly refreshes even when the operator changes away from the initial filter and later returns to it.

## Preserved behavior

- Work queue status rules remain unchanged.
- Policy Number continues to open the canonical reconciliation drawer.
- Business MIS columns/order/template remain unchanged.
- Bill Amount remains received Pay-In.
- No accounting write path changes.
- No database/schema/RLS/migration changes.
- No mobile/APK/AAB/native changes.

## Release state

Implementation is committed on the feature branch. Canonical **Verify web portal** must pass before merge. Merge and production deployment are separate evidence states and must not be inferred from this document.
