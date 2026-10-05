# Partner Customer Detail Vehicle → Policy → Claims Handoff — 2026-10-05

## Scope

This change restructures the Partner App Customer Details screen around the actual vehicle relationship rather than rendering Policies, Vehicles and Claims as three unrelated flat sections.

Requested mobile UX:

1. Vehicles are the primary customer-detail list.
2. A vehicle with one or more policies shows a right-side **View Policy** control.
3. Policy content is collapsed by default and expands inline under that vehicle.
4. Each expanded policy shows its existing insurer/logo, policy identity, type, expiry and premium summary and continues to open the existing Policy Detail route.
5. If that policy has one or more claims, it shows a right-side **Claims N** control.
6. Claims are collapsed by default and expand only under their owning policy.
7. Each claim continues to open the existing Claim Detail route.
8. Policies without a vehicle relationship and claims without a usable returned policy relationship remain visible in fallback sections so non-motor/life/health or legacy data is not silently dropped.

## Data-contract change

The existing `public.partner_app_customer_detail(uuid)` RPC already enforces customer scope, policy scope and claim scope. No new table, public data path or authorization mechanism is introduced.

The RPC response is extended only with relationship identifiers already present in canonical tables:

- policy payload: `vehicle_id`
- claim payload: `vehicle_id`
- claim payload: `policy_id`

Existing fields and counts remain unchanged. Existing `partner_app_customer_in_scope`, `partner_app_policy_in_scope` and `partner_app_claim_in_scope` checks remain unchanged.

Migration:

`supabase/migrations/20261005102500_partner_customer_vehicle_policy_claim_links.sql`

The migration is committed for controlled deployment after merge. It has **not** been applied to production as part of this branch/PR preparation.

## App files

- `apps/partner-app/app/customer/[id].tsx`
  - vehicle-first rendering
  - per-vehicle policy expand/collapse
  - per-policy claim expand/collapse
  - existing Policy Detail and Claim Detail navigation preserved
  - manufacturer/insurer logo helpers and existing status badges preserved
- `apps/partner-app/lib/customers.ts`
  - Partner customer-detail TypeScript contract extended with the relationship IDs above

## Release / native impact

This is an OTA-safe JS/TS/UI + server RPC contract change. It does not change Expo SDK, native dependencies, permissions, package IDs, runtime version, EAS plugins or Android native configuration.

**Do not create an APK/AAB for this change unless the user explicitly authorizes a native build.**

## Evidence state

- Branch: `feature/partner-customer-vehicle-policy-claims`
- App implementation: **IMPLEMENTED**
- Migration file: **IMPLEMENTED / NOT APPLIED**
- PR: pending at time this handoff was written
- CI: pending
- Merge: **NOT MERGED**
- Production migration: **NOT APPLIED**
- Production runtime 0.2.0 OTA: **NOT DEPLOYED**
- Installed-device verification: **UNVERIFIED**
- APK/AAB: **NOT CREATED**

## Verification checklist before merge/deployment

- CI/typecheck/lint/tests are green.
- Customer with vehicle + active policy shows `View Policy` and expands correct policy.
- Customer with multiple historical policies on one vehicle shows all returned policies in latest/end-date order.
- Policy with claims shows `Claims N`; unrelated claims do not appear under it.
- Policy with no claims has no Claims toggle.
- Vehicle with no policy has no View Policy control.
- Life/Health or other policies without vehicle linkage remain accessible in the fallback section.
- Existing Partner scope cannot expose another Partner's customer, policy or claim.
- After merge, apply the migration before publishing the corresponding OTA so the app receives the new relationship IDs.
