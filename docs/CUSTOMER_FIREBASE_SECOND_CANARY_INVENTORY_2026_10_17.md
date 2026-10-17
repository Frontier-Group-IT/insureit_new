# Firebase Customer second canary — 2026-10-17 production cohort screening

## State

**Read-only audit complete; Firebase enrollment, Auth alias mutation and genuine second Android OTP test NOT performed.** Existing Customer 1634 bridge canary remains the only confirmed end-to-end test. Do not replace deployed Edge v7 or retire 2Factor based on this audit.

## Live production evidence

Source: Supabase project `ilzhsfqqjyppzzvfscmh`, run by connected privileged read-only SQL on 2026-10-17. Query: `scripts/customer-firebase-second-canary-readonly-inventory.sql`. Output is **anonymous aggregate counts only**. No Customer UUID, UID, name, phone or email returned.

| Measure | Count |
|---|---:|
| Active Customer profiles | 24 |
| Active Customers with original matching, unbanned, non-anonymous Auth user and canonical phone | 24 |
| Active Customers with a phone collision in profiles or Auth | 6 |
| Conflict-free Customers with matching original Auth identity | 18 |
| Conflict-free matching Customers missing Firebase link and Auth email | 18 |
| Conflict-free matching Customers with existing approved Firebase link and confirmed Auth email | 0 |
| Multiple Firebase mappings for one Customer | 0 |
| Missing/invalid phone/Auth identity | 0 |

Totals describe different attributes and overlap; **do not add them**. A zero under multiple links does not establish global UID uniqueness, because a Firebase-signed UID is not known for never-enrolled Customers. The 18 are **candidate accounts requiring ownership consent and provision**, NOT accounts that have completed Firebase migration.

Live existing approved links: only two, and both phones have an active non-Customer shared-phone conflict. Customer 1634 has confirmed Auth email and successful prior same-UUID Android Firebase bridge. Customer 2509 lacks the confirmed Auth email. Owner-designated dummy Customer 1014 is not linked, lacks an Auth email and shares its mobile with an active IT Super User.

## Implemented and verified in source

- Pure server-side precheck `supabase/functions/_shared/customer-firebase-second-canary-preflight.mjs` requires both complete profile and Auth-phone inventories and mapped-UID inventory, rejects shared Auth identities and duplicate mapped UIDs, and cannot approve or write an identity.
- Node synthetic safety CI passed [#39026403828](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/39026403828) and subsequent runs.
- Aggregate-only production SQL is wrapped in `BEGIN TRANSACTION READ ONLY` and `ROLLBACK`. A disposable PostgreSQL 17 workflow tests its real SQL against fake identities and asserts totals for shared/staff, unshared, approved link and banned cases.
- It is not connected to a public endpoint. No login status, customer list, IDs or SMS token is exposed. No Auth/profile/Firebase/Edge/Storage writes were performed.

## Next controlled, actionable release path

1. Select one of the 18 phone-unique Customers only with verified ownership and consent, or create a new fully consented Customer test account *through the approved app onboarding flow*. An admin must select the exact Customer UUID privately; do not let raw phone input pick an existing UUID.
2. To reuse existing production Edge v7 bridge, the Customer must have a verified immutable Firebase UID association and an approved confirmed same-UUID Auth email identity. Currently **no unshared Customer has both**.
3. Existing Customer Auth credential/email modification needs a verified recoverable Auth backup + independent GoTrue restore; this is a prerequisite only for such sensitive changes, not for ordinary SMS login of previously provisioned accounts. Operator-owned recovery work remains draft PR #3220.
4. For shared-phone Customer 1014, obtain independent ownership evidence and **second authenticated active IT Super User review**, separately preserving the staff login. Phone SMS possession alone is insufficient. No review record has been created here.
5. Once account provisioned through approved reviewed flow, owner performs fresh Firebase OTP in the internal Android app (not by sharing SMS code in chat). Test original UUID, self Customer/vehicles/policies/claims, cross-Customer denial, private Storage, token refresh, logout and account switching. Preserve 2Factor fallback. Stop if any unintended principal or Customer data is reached.
6. Only then propose a strictly server-side rollout cohort of consenting, reviewed existing Customers with default-deny kill switch and rollback. No mass alias creation or blind UID linking.

## Release decision

**Ready for repeated aggregate preflight; NOT ready for live second canary or all-Customer activation.** PR #3232 remains source-only draft. No migrations, merge, deployment, OTA/APK/AAB, automatic OTPs, or production Auth writes were performed by this audit.

## 2026-10-17 — Trusted operator preview implementation, NOT DEPLOYED

New source-only function `supabase/functions/customer-firebase-operator-preview/index.ts` and pure handler `supabase/functions/_shared/customer-firebase-operator-preview.mjs` create an **operator-only, read-only** pathway to evaluate ONE expressly chosen existing Customer UUID. The function is disabled unless a server-side environment flag `CUSTOMER_FIREBASE_OPERATOR_PREVIEW_ENABLED=true` is set. **No such flag was changed or endpoint deployed in production**.

Once separately approved for deployment, the caller would need a genuine authenticated Supabase IT Super User bearer token plus a short-lived, signed/revocation-checked Firebase phone ID token in a bounded POST JSON body. It calls the existing reviewed enrollment resolver, which demands exact original Auth/Customer UUID, canonical phone, immutable UID uniqueness, independently registered ownership and consent in the latest restricted review journal, and an independent second active IT reviewer for staff/shared-phone conflicts. A missing verified Auth alias is surfaced as a **protected-recovery-required** state, never silently provisioned.

The handler returns only coarse stages (`reviewed_existing_session_manual_test_candidate`, `approved_link_write_still_pending`, `protected_auth_recovery_required`, or generic denial). It does not return Customer IDs, phones, Auth details, Firebase UIDs or tokens; does not grant credentials, enroll users, update Auth, send OTP or create a Supabase session; and is not a substitute for real Android testing.

**Live dependency verified READ-ONLY:** current production project has no `customer_firebase_enrollment_reviews` audit journal, no `customer_firebase_rollout_control` table and no reviewed-enrollment RPC. Existing prepared migrations remain unapplied. Therefore the preview would **fail closed** until a separately reviewed rollout of the authorization infrastructure. No production DDL, data write or Edge deployment has occurred. No unshared existing Customer can be provisioned solely from the 18-row aggregate; independent explicit ownership/consent and protected Auth recovery are still required for accounts whose original Auth email is missing.

### Owner action and release order
1. Owner-controlled protected Auth backup + verified matching-GoTrue restore and original-login/UUID recovery attestation (draft PR #3220) before email alias/credential mutation.
2. Obtain an exact eligible Customer UUID and independently verified Customer ownership/consent via an approved private operator process. Do not select a real user automatically or collect an OTP in ChatGPT/GitHub.
3. Independently security-review and apply the prepared journal/collision/enrollment control migrations with controlled rollback, before enabling any operator preview.
4. Approve deployment of the disabled-by-default operator preview with `verify_jwt=true`; test only with real approved IT Super User and consenting Customer. This does **not** turn on public enrollment or the full Firebase bridge.
5. After authenticated operator review and owner authorization, provision same-UUID Auth alias/approved UID through reviewed, auditable tooling only, then conduct genuine Android sign-in, exact UUID/vehicle/policy/claim/Storage isolation and refresh tests.
6. Expand from limited, separately approved Customer cohorts only after documented real-device and RLS acceptance. Preserve staff and 2Factor login; no OTA/APK/AAB without release approval.

