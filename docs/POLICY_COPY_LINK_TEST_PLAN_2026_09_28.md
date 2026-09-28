# Policy-copy linkage test plan

1. Insert a Customer App external policy and then a `customer_documents` `policy_copy` row for the same customer/user without `external_policy_id`; expect automatic linkage when exactly one candidate exists.
2. Insert a policy-copy row when two qualifying recent external policies exist; expect no automatic linkage.
3. Insert a non-policy-copy document; expect no change.
4. Insert a policy-copy document that already has `external_policy_id`; expect the supplied link to remain unchanged.
5. Confirm Policy Detail can resolve the repaired reported record through `customer_documents.external_policy_id`.
