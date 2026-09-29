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

Migration `20260929070000_extend_life_health_case_document_types.sql` widens the existing `document_type` check constraint to allow:

- `proposal_form`
- `benefit_illustration`
- `premium_receipt`
- `policy_copy`
- `kyc`
- `other_document`

No table shape, RLS, storage bucket or uniqueness rule changes.

## Evidence state

- UI/document wiring: IMPLEMENTED on PR #2534.
- Production constraint before migration: VERIFIED to allow only proposal_form / benefit_illustration / premium_receipt / policy_copy.
- Migration: committed on the feature branch; production application and verification are required before deployment is considered safe.
- Merge/deployment: pending canonical `Verify web portal` success and explicit release workflow completion.

## Continuation

Do not deploy the Life compact-upload UI unless the widened production constraint is APPLIED and VERIFIED. A committed migration alone is not proof of runtime schema state.
