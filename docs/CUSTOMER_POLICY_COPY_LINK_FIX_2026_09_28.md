# Customer policy-copy linkage fix — 2026-09-28

## Problem

The Customer App Add Vehicle flow creates an `external_policies` row and then uploads the policy copy into `customer_documents`. The upload helper used by this flow can omit `external_policy_id`, so Policy Detail cannot find the uploaded copy even though the file and document row exist.

## Production evidence

For the reported MH19BN4334 case, the policy copy existed in `customer_documents` with `document_type = 'policy_copy'` and the correct customer, but `external_policy_id` was null. The affected row was repaired directly and re-queried successfully.

## Permanent guard

Migration `202609280001_link_customer_policy_copy_to_external_policy.sql` adds a narrow BEFORE INSERT trigger for `customer_documents`. It acts only when a Customer App policy-copy insert omits `external_policy_id`. It links the document only when exactly one unambiguous external-policy candidate exists with the same customer, same user, `added_via = 'customer_app'`, created in the preceding 10 minutes, and no existing policy-copy document. If the match is ambiguous, it leaves the document unchanged rather than guessing.

This is a database compatibility guard for existing Customer App clients and does not create or require an APK/AAB.
