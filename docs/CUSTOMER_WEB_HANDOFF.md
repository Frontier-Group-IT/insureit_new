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

## 2026-10-07 — Cloudflare Customer session compatibility fix

Rebased branch: `fix/customer-web-cloudflare-session-rebased-2026-10-07`.

Observed on `insureit-new.shahdolho.workers.dev/customer/login`:
- phone OTP completed successfully;
- browser-side active Customer profile validation completed successfully;
- failure occurred only when `/customer/auth/session` attempted to establish the secure HTTP-only web session.

Implementation:
- Customer-only session verification now uses `supabase.auth.getUser(accessToken)` plus a scoped `profiles` lookup instead of the shared `getAuthenticatedProfile()` / `getClaims()` path;
- token verification remains server-side; no trust is transferred to browser-only role checks;
- safe Customer-specific response codes distinguish session failures without exposing tokens, secrets or provider internals;
- Customer isolation regression requires server-side token/profile verification and rejects Partner/service-role/shared-claims coupling.

Explicit non-changes:
- no Partner Portal files, RPCs, authorization helpers or navigation changed;
- no Operations pages, capabilities, roles or business logic changed;
- no shared middleware change;
- no Supabase schema/RLS/data change;
- no production deployment, OTA, APK or AAB.

State: **IMPLEMENTED ON LATEST-MAIN REBASED BRANCH; CI/MERGE/CLOUDFLARE PREVIEW VERIFICATION PENDING.**
