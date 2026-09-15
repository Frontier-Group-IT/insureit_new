# Partner Claim Operations Parity — 2026-09-15

## Requested outcome

The Partner Portal claim detail route `/partner/claims/[id]` must use the same working nine-stage claim journey as the Operations route `/claims/[id]`, not a read-only summary.

Canonical stages:

1. Spot Intimation
2. Spot Status
3. Claim Intimation
4. Work Approval
5. Repair & RI
6. Billing
7. Delivery Order
8. Vehicle Delivery
9. Payment Encashment

The Partner experience must reuse the same stage UI, validations, save/advance behavior, document upload/classification/replace/reupload/verification behavior, and stage locking/progression rules wherever the canonical shared components expose them.

## Implementation

- Partner claim detail now renders the canonical `SpotClaimHeader`, `OperationsClaimStages`, `SpotSurveyWorkspace`, and `FinalDocumentsWorkspaceV2` inside `PartnerPortalShell`.
- `lib/partner-claim-operations.ts` loads the detailed Operations workspace dataset only after `getPartnerWebClaimDetail(claimId)` proves the claim is inside the authenticated Partner's commercial scope.
- `lib/claim-workflow-access.ts` is the common mutation authorization boundary:
  - employees retain effective `manage_claims` edit permission plus customer-scope checks;
  - intermediary users do **not** receive global `manage_claims`;
  - an intermediary mutation is admitted only after authenticated `partner_app_claim_detail(p_claim_id)` proves that exact claim is visible to that Partner account;
  - after scope proof, the service client performs the canonical workflow write so employee-only table RLS does not silently break Partner workflow parity.
- Shared claim stage, Spot Intimation, Spot Survey, signed document upload, final document, classification, verification compatibility, document-open and Spot Survey completion actions were adapted to use the claim-specific authorization boundary and revalidate both Operations and Partner routes.

## Security boundary

This implementation intentionally does not add `manage_claims` to the default intermediary role and does not create a broad Partner mutation RPC. The Partner scope proof is record-specific and performed before each privileged mutation path.

## Database / schema

- No migration added.
- No schema change.
- No new RPC.
- No production data mutation performed as part of implementation.

## PR

- Branch: `feature/partner-claim-operations-parity-v4`
- PR: #1835 — `Match Partner Claim Details to Operations 9-stage workflow`
- Release state: **IMPLEMENTED ON FEATURE BRANCH / NOT MERGED / NOT DEPLOYED**

## Verification history

- Initial claim effective-permission regression failed because the regression still expected the permission call to live directly inside `stage-actions.ts`; the permission was intentionally centralized in `claim-workflow-access.ts`. The regression was updated to assert the new shared boundary without weakening the employee permission/customer-scope checks or Partner exact-claim RPC check.
- Subsequent claim effective-permission RLS runs are green.
- The broad web gate exposed source-shape assumptions in the existing claim upload regression after authorization was centralized. The regression was modernized to retain the substantive upload, replacement, direct-storage, verification, insurance-period and scope protections while accepting the shared authorization architecture.

Do not mark this work MERGED, DEPLOYED or production VERIFIED until PR #1835 is explicitly approved, merged, the canonical production workflow succeeds, and Vercel is READY for the exact merged commit.
