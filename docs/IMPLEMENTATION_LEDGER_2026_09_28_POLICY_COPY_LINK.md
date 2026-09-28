# Implementation ledger entry

- **2026-09-28 — Customer policy-copy external-policy linkage:** branch `fix/customer-vehicle-policy-copy-link`; adds a narrow database compatibility guard so Customer App policy-copy uploads that omit `external_policy_id` are linked only when there is exactly one same-customer/same-user recent Customer App external-policy candidate. The reported production record was repaired and verified separately. **IMPLEMENTED; PR/CI/merge/migration application pending. NO APK/AAB.** See `docs/CUSTOMER_POLICY_COPY_LINK_FIX_2026_09_28.md`.
