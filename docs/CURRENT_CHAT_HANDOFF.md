# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md`, `docs/mobile-web-continuation-handoff.md`, `docs/mobile-app-production-review.md`, `docs/mobile-app-polish-roadmap.md`, `docs/claim-role-responsibility-model.md`, and `docs/claim-manager-web-handoff.md`. Never store secrets, policyholder PII, or complete policy documents here.

## Active track — self-managed external-policy claims

Immediate work is on `feature/self-managed-claims`, Draft PR #274. Browser review URL: `https://frontier-group-it.github.io/insureit_new/`.

At the user's explicit direction, this preview uses the original InsureIT Supabase project. Code/deployment is branch-isolated, but database writes are real. Do not create/delete test customer or claim data on the user's behalf.

Product model:

- `policy_service_source`: `sibl | external`
- `claim_service_mode`: `broker_managed | self_managed`
- `assistance_status`: `not_requested | requested | accepted | declined | cancelled`

Assistance is not a service mode. Self-managed milestone progress must not be represented as OPS ownership through `claims.current_status`.

Live additive migrations applied and committed:

- `20260812050614_claim_service_mode_foundation.sql`
- `20260812051129_claim_control_number_by_service_source.sql`
- `20260812051532_create_self_managed_claim_rpc.sql`

Verified behavior:

- pre-existing claims remained `broker_managed`
- historic policies were deliberately not auto-classified as SIBL/external
- self-managed milestones use `claim_milestones` with customer RLS
- explicit external claims receive `EXT/####`; broker/unknown claims retain `SIBL/####`
- self-managed creation atomically creates the claim and Spot Intimation milestone
- ordinary self-managed claims are excluded from the web Claims Desk default register; broker-managed claims and explicit assistance requests remain eligible

Reviewable mobile slice deployed:

- Start/Add Claim service-mode choice
- Broker-Managed choice retains existing `report-accident`
- Self-Managed Spot Intimation, step 1/9
- nine-stage self-managed tracker
- Spot Status, step 2/9
- self-managed claims reopen in the tracker from customer/group claim lists
- persistent notice: `This claim is being tracked by you. Sankalp is not processing this claim unless you request assistance.`

Exact deployed app revision passed mobile typecheck, mobile lint, Expo Web export, browser artifact upload, web access-control regressions, insurer regressions, web typecheck, web lint and web production build.

Still pending: milestone forms 3–9, document vault/multi-file upload, financial summary, Request Sankalp Assistance, full portal mode tabs/CRM views, notifications, final summary/export/share, native Android verification, and explicit classification workflow for historic policies.

Safety: new database work must remain small, additive/backward-compatible, and be verified immediately. Self-managed claims must stay out of OPS work queues unless assistance is explicitly requested.

## Parallel/deferred track — Policy Onboarding OCR

Preserve the prior Policy Onboarding OCR hardening work; it is not the immediate task on this branch. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` changes only after explicit production-deploy instruction.

Known IFFCO accounting target retained from prior handoff:

```text
Basic TP 7267 + Legal Liability 100 = TP 7367
CPA = 330
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

Structured IFFCO financial parsing lives in `apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts`; it uses Document AI table-cell anchors and withholds financial fields when the accounting equation cannot reconcile. Regression: `npm run policy-ocr:iffco-structured-regression`. United India remains deferred.
