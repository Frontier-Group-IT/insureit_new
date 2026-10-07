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

## 2026-10-07 — Customer Web Phase 2: Renewals and Claim Tracking

Branch: `feature/customer-web-phase2-renewals-claims-2026-10-07`.

Implemented strictly inside Customer Web:
- `/customer/renewals` with the Customer App's 45-day renewal window for Insurance Policy, National Permit, Local Permit, Road Tax, PUC and Fitness;
- summary counts for pending, due soon and expired items, with document-type filters and vehicle drill-down;
- `/customer/claims` with All / Open / Action Required / Completed filters, search, internal vs external/self-tracked identity, assistance-request status and milestone-aware completion;
- `/customer/claims/[id]` with claim identity, policy/insurer/vehicle context, progress, shared internal claim journey projection, self-tracked external milestone journey, document count, open task count and assistance state;
- Customer desktop/mobile navigation now includes Renewals and Claims;
- `lib/customer-web-phase2-data.ts` is read-only and uses the normal authenticated Supabase/RLS client.

Safety boundary for Phase 2:
- no claim creation, claim update, milestone write, document upload/delete or assistance-request mutation is exposed on Customer Web yet;
- no Partner Portal functionality changed;
- no Operations Portal functionality changed;
- no Partner/Operations authorization, RPC or capability changes;
- no schema/RLS/data migration;
- no mobile runtime/OTA/APK/AAB changes.

State: **IMPLEMENTED ON REVERSIBLE BRANCH; PR/CI/MERGE/PREVIEW VERIFICATION PENDING.**
