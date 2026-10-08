## 2026-10-08 — Customer Web claim/create/9-stage parity implementation (PR #2970)

- Branch: `feature/customer-web-start-claim-phase1-2026-10-08`; draft PR #2970; **implemented on branch, NOT MERGED, NOT DEPLOYED, RUNTIME UNVERIFIED**.
- Customer-only protected routes: `/customer/start-claim`, `/customer/add-vehicle`, `/customer/add-policy`, `/customer/spot-intimation`, `/customer/claims/[id]/stage/[stage]`.
- Vehicle creation uses `create_customer_vehicle_v2` via authenticated Customer RPC with customer-account validation; RC lookup reuses the existing authenticated `/api/customer/rc-lookup` AuthBridge route.
- External policy creation uses existing `create_customer_external_policy` RPC, class-aware product selection, active-policy prevention, 5 MB copy upload and customer document metadata.
- Internal managed claim creation prepares a Draft then Spot Intimation advances to `Initial Documents Pending`; external self-tracked claim uses `ensure_self_managed_external_claim_draft` and `finalize_self_managed_external_claim_draft`. No Operations-owned status is editable by later stage forms.
- Nine-stage customer drilldowns use `INTERNAL_JOURNEY_STAGES`; permitted external self-managed updates use `save_self_managed_milestone` or mobile-matched direct customer milestone upsert for Spot Status/Vehicle Delivery. Stage date, sequencing, role, and ownership validation are enforced.
- Customer evidence upload to `claim-documents` and `claim_documents` has format/size checks and storage cleanup; no verified document deletion.
- Exact mobile Start Claim hero/footer and 9 stage icons copied from original blobs; web catalog manufacturer/insurer logos reused.
- Known gaps to verify before considering release: complete UI parity and all mobile form details, internal/external real-account end-to-end tests, RC errors/registration edge cases, upload RLS/runtime behavior, and customer authorization regressions. GitHub verification must pass latest head. No APK/AAB.
- Detailed continuity: `docs/CUSTOMER_WEB_START_CLAIM_IMPLEMENTATION_2026_10_08.md`.

---

# INSUREIT Customer Web Handoff

> Created: 2026-10-07 (IST)

## Objective

Create a browser Customer Portal that reaches parity with the existing Customer App without destabilizing the working Partner or Operations portals.

## Architecture decision

Customer Web lives as an isolated route surface inside `apps/web-portal` under `/customer`.

It may reuse safe visual and engineering patterns from the Partner Web Portal, but it must not reuse Partner authorization, Partner commercial scope, Partner RPC contracts, or employee capabilities.

Authorization boundaries remain:

- `/partner` → intermediary-only Partner authorization.
- Operations routes → existing employee/capability authorization.
- `/customer` → active `customer` profile only.

The Customer App remains the business-behavior source of truth for Customer functionality. Customer Web should port each module against the same Supabase records/RPCs/RLS rather than create duplicate Customer data.

## Foundation branch

Branch: `feature/customer-web-foundation-2026-10-07`

Implemented foundation:

- isolated Customer Web session guard in `lib/customer-web.ts`;
- active Customer profile requirement;
- Customer account resolution from direct `customers.profile_id` ownership plus active `customer_memberships`;
- dedicated Customer OTP login using existing Supabase phone OTP with `shouldCreateUser: false`;
- dedicated `/customer/auth/session` endpoint that accepts Customer profiles only;
- protected Customer route group and responsive Customer shell/navigation;
- initial protected `/customer/home` foundation page;
- dedicated `customer-web:foundation-regression` security/isolation guard.

## Explicit non-changes

This foundation does not modify:

- Partner Portal routes, navigation, Partner RPCs, or `getPartnerWebSession`;
- Operations routes, employee capabilities, or existing `/auth/session`;
- existing Partner/Operations middleware routing behavior; the shared middleware now has an additive Customer-only session state and `/customer` session-refresh coverage required by repository regression policy;
- Supabase schema, migrations, RLS, Storage, or production data;
- Customer App runtime or Expo configuration;
- APK/AAB or OTA workflows;
- Vercel production deployment or production domains.

## Security rules

1. Customer Web must explicitly require `profile.role === "customer"`.
2. Customer routes must never authorize through Partner commercial scope.
3. Customer Web must not use `supabase-admin`, service-role credentials, or employee capabilities for customer reads.
4. Partner and Operations authorization must remain unchanged while the Customer foundation is being validated.
5. Customer feature pages must enforce customer ownership/membership through existing RLS/RPC contracts before release.
6. No Customer Web production exposure until isolation + repository regression checks pass and the user explicitly approves deployment.

## Rollout plan

1. Foundation / isolation.
2. Customer Home parity.
3. Vehicles.
4. Policies + Renewals.
5. Claims.
6. Support / Service Enquiries and customer services.
7. Profile / KYC / documents.
8. Customer Exchange.
9. Responsive/browser compatibility hardening.
10. Customer App ↔ Customer Web parity regressions and dedicated production-domain rollout.

## Evidence state

**IMPLEMENTED ON FEATURE BRANCH; PR #2882 OPEN. Verify web portal run #5399 passed on the functional middleware/customer foundation head, including Customer isolation, Partner security, server-session coverage, typecheck, lint and production build. Final documentation/regression-hardening head requires its own green rerun. MERGE/DEPLOYMENT PENDING.**

No APK/AAB created.