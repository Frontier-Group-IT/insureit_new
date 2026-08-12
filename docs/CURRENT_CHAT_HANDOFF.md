# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/mobile-web-continuation-handoff.md`, `docs/mobile-app-production-review.md`, `docs/mobile-app-polish-roadmap.md`, `docs/claim-role-responsibility-model.md`, and `docs/claim-manager-web-handoff.md`. Never store secrets, policyholder PII, or complete policy documents here.

## Active track — self-managed external-policy claims

The immediate active work is the new customer-owned self-managed claim tracking flow on branch `feature/self-managed-claims`, Draft PR #274. Browser review URL: `https://frontier-group-it.github.io/insureit_new/`.

At the user's explicit direction, this preview uses the original InsureIT Supabase project. Code/deployment is isolated by branch, but database writes are real production-project writes. Do not create or delete test claims/customer data on the user's behalf.

The product model separates:

- `policy_service_source`: `sibl | external`
- `claim_service_mode`: `broker_managed | self_managed`
- `assistance_status`: `not_requested | requested | accepted | declined | cancelled`

Do not fold assistance into service mode. Do not use operational `claims.current_status` as the owner of self-managed milestone progression.

Live additive migrations already applied and committed:

- `20260812050614_claim_service_mode_foundation.sql`
- `20260812051129_claim_control_number_by_service_source.sql`
- `20260812051532_create_self_managed_claim_rpc.sql`

Verified behavior:

- all pre-existing claims remained `broker_managed`
- existing policies were deliberately NOT auto-classified as SIBL/external because historic intermediary metadata is inconsistent
- self-managed milestones live in `claim_milestones` under customer RLS
- explicit external claims receive `EXT/####`; broker/unknown claims retain existing `SIBL/####` numbering
- customer self-managed creation atomically inserts the claim and completed Spot Intimation milestone
- ordinary self-managed claims are excluded from the web Claims Desk default register; broker-managed claims and explicit assistance requests remain eligible

Reviewable mobile slice currently deployed:

- Start/Add Claim service-mode choice
- Broker-Managed choice retains the existing `report-accident` flow
- Self-Managed Spot Intimation (step 1/9) is functional
- dedicated nine-stage self-managed tracker is functional
- Spot Status (step 2/9) is functional
- self-managed claims reopen in the self-managed tracker from customer/group claim lists
- persistent notice: `This claim is being tracked by you. Sankalp is not processing this claim unless you request assistance.`

Exact deployed app revision passed mobile typecheck, mobile lint, Expo Web export, browser artifact upload, web access-control regressions, insurer regressions, web typecheck, web lint and web production build.

Still pending and must NOT be described as complete:

- milestone forms 3–9
- document vault / multi-file uploads
- financial summary/calculations
- Request Sankalp Assistance workflow and accept/decline handling
- full portal Broker Managed / Self Managed / Assistance Requested views
- CRM/renewal insights
- self-managed notifications/reminders
- final summary/export/share
- native Android verification
- explicit persistent classification workflow for historic policies

Safety rule: new database work must remain small, additive/backward-compatible, and be verified immediately after application. Self-managed claims must stay out of OPS work queues unless assistance is explicitly requested.

## Parallel/deferred track — Policy Onboarding OCR

The previous chat handoff tracked Policy Onboarding OCR hardening. Preserve that work, but it is not the immediate task in this branch. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` changes only after the user explicitly says `deploy now` or `finish and deploy`.

### Verified pre-change parser baseline

User-local baseline before the latest structured-table architecture work:

```text
IFFCO regression:    10/10 passed
Digit regression:     5/5 passed
New India regression: 5/5 passed
Typecheck:             passed
Lint:                  0 errors
Build:                 passed
```

Do not reuse this baseline as proof for later OCR commits.

### Live production findings

Repeated tests with IFFCO policy `N8109328` established:

- insurer detection fixed: IFFCO-TOKIO
- product fixed: Package
- policy number fixed
- IDV fixed
- valid from/upto fixed and apply correctly
- CPA later read correctly as 330
- flattened OCR premium interpretation remained unsafe

Known correct accounting target:

```text
Basic TP 7267 + Legal Liability 100 = TP 7367
CPA = 330
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

Structured IFFCO financial parsing was added in `apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts`, using Document AI table-cell anchors and withholding financial fields when the accounting equation cannot reconcile. Relevant regression: `npm run policy-ocr:iffco-structured-regression`. United India remains deferred.
