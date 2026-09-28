# Current chat handoff — Customer policy copy linkage

- Date: 2026-09-28
- Branch: `fix/customer-vehicle-policy-copy-link`
- Area: Customer App Add Vehicle → external policy → policy-copy linkage
- Evidence state before PR: **IMPLEMENTED** in migration; reported production row manually repaired and verified; migration not yet applied at the time this note was written.
- Root cause: Add Vehicle policy-copy insert can omit `customer_documents.external_policy_id`, while Policy Detail requires that foreign key to locate the document.
- Fix: narrow database compatibility trigger links only an unambiguous same-customer/same-user/recent Customer App external policy; ambiguous cases remain untouched.
- No APK/AAB is required or authorized for this fix.
