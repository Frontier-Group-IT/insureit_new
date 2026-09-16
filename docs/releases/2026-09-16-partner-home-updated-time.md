# Partner Home updated-time removal

Release note for the Partner Home header change merged in PR #1918.

- Removes the visible `Updated <time>` label from Partner Home.
- Keeps the Welcome heading and active Scheme display unchanged.
- No database or schema change is required for this UI-only release.

This release marker exists so the protected production deployment workflow can deploy the current verified `main` snapshot after intervening direct housekeeping commits caused the original merge-triggered deployment to be skipped as stale.
