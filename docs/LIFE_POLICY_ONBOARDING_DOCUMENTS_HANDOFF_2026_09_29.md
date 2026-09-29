# Life Policy Onboarding compact document uploads — 2026-09-29

## Scope

PR #2534 / branch `ui/life-policy-compact-document-uploads` changes the Life Policy Onboarding document area to four compact upload actions in this order:

1. Policy Copy
2. Proposal Form
3. KYC
4. Other Document

Health keeps its existing Proposal Form / Benefit Illustration / Premium Receipt flow.

## Persisted document contract

Life/Health case documents continue to use `public.life_health_case_documents` with one row per `(case_id, document_type)`.

The production `life_health_case_documents_document_type_check` now allows:

- `proposal_form`
- `benefit_illustration`
- `premium_receipt`
- `policy_copy`
- `kyc`
- `other_document`

The production schema change was applied through the Supabase migration service as `extend_life_health_case_document_types`, recorded remotely as version `20260929062841`. The applied DDL drops and recreates only the existing document-type check constraint with the six allowed values above, then validates it. No table shape, RLS, storage bucket or uniqueness rule changed.

## Evidence state

- UI/document wiring: **IMPLEMENTED** on PR #2534.
- Production constraint before schema change: **VERIFIED** to allow only proposal_form / benefit_illustration / premium_receipt / policy_copy.
- Production schema change: **APPLIED** to Supabase project `ilzhsfqqjyppzzvfscmh` on 2026-09-29.
- Post-apply verification: **VERIFIED**; `life_health_case_documents_document_type_check` is validated and allows all six document types including `kyc` and `other_document`.
- The schema was applied and verified before web deployment so the new KYC / Other Document uploads cannot hit the old four-value constraint.
- Merge/deployment: pending canonical `Verify web portal` success and production release workflow completion.

## Continuation

The production schema prerequisite for the Life compact-upload UI is APPLIED + VERIFIED. Merge only after the canonical PR verification succeeds, then deploy through the protected production GitHub Actions workflow and verify the exact Vercel production deployment before marking the feature DEPLOYED.
