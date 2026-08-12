# Current Chat Handoff

> **Consolidated:** 2026-08-09 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Self-managed claims continuation checkpoint — 2026-08-12

A separate claim-development track is active on branch `feature/self-managed-claims` in Draft PR #274. Its browser review URL is `https://frontier-group-it.github.io/insureit_new/`. The user explicitly chose to connect that preview to the original InsureIT Supabase project, so preview writes are real database writes even though the code/deployment branch is isolated.

The product model now separates three concepts:

- `policy_service_source`: `sibl | external`
- `claim_service_mode`: `broker_managed | self_managed`
- `assistance_status`: `not_requested | requested | accepted | declined | cancelled`

Do not fold assistance into the service mode and do not overload operational `claims.current_status` with customer-owned self-tracking state.

Live additive migrations already applied and committed on the feature branch:

- `20260812050614_claim_service_mode_foundation.sql`
- `20260812051129_claim_control_number_by_service_source.sql`
- `20260812051532_create_self_managed_claim_rpc.sql`

Important verified behavior:

- all pre-existing claims remained `broker_managed`
- existing policies were deliberately NOT auto-classified as SIBL/external because historical intermediary metadata is not reliable enough
- self-managed claims use `claim_milestones` with customer RLS rather than operational claim-status transitions
- explicit external claims receive `EXT/####`; broker/unknown claims retain existing `SIBL/####` numbering
- the customer RPC creates the self-managed claim + completed Spot Intimation atomically
- ordinary self-managed claims are excluded from the web Claims Desk default register; broker-managed claims and explicit assistance requests remain visible

Reviewable mobile slice currently deployed:

- Start/Add Claim service-mode choice
- existing Broker-Managed path remains the current `report-accident` flow
- Self-Managed Spot Intimation (step 1/9) is functional
- dedicated nine-stage self-managed tracker is functional
- Spot Status (step 2/9) is functional
- self-managed claims reopen in the self-managed tracker from customer/group claim lists
- persistent notice: `This claim is being tracked by you. Sankalp is not processing this claim unless you request assistance.`

Exact deployed revision passed mobile typecheck, mobile lint, Expo web export, browser artifact upload, web access-control regressions, insurer regressions, web typecheck, web lint and web production build.

Still pending and must NOT be described as complete:

- milestone forms 3–9
- claim document vault/bulk upload
- financial summary/calculations
- Request Sankalp Assistance accept/decline workflow
- full portal Broker Managed / Self Managed / Assistance Requested views
- CRM/renewal insights
- self-managed notifications/reminders
- final summary/export/share
- native Android verification
- explicit persistent classification workflow for historical policies

Safety rule: because this branch shares the live Supabase database, keep every new migration small, additive/backward-compatible, verify it immediately, and do not create/delete test customer records or claims on the user's behalf. Let the user create any review claim from the preview.

## Active track

Policy Onboarding OCR hardening is the immediate active work. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

## Verified pre-change parser baseline

User-local baseline before the latest structured-table architecture work:

```text
IFFCO regression:    10/10 passed
Digit regression:     5/5 passed
New India regression: 5/5 passed
Typecheck:             passed
Lint:                  0 errors
Build:                 passed
```

Do not reuse this as proof that the new structured-table commits pass.

## Live production findings

Repeated live tests with IFFCO policy `N8109328` established:

- insurer detection fixed: IFFCO-TOKIO
- product fixed: Package
- policy number fixed
- IDV fixed
- valid from/upto fixed and apply correctly
- CPA later read correctly as 330
- flattened OCR premium interpretation remained unsafe, producing OD `1` and TP values such as `997134`/`22409`

Durable learning: flattened table reading order must not be used as the sole financial evidence.

Known correct accounting target:

```text
Basic TP 7267 + Legal Liability 100 = TP 7367
CPA = 330
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

## Current implementation

**IMPLEMENTED / NOT YET DEPLOYED OR VERIFIED:** a second IFFCO financial pass now consumes Google Document AI table cell anchors (`pages[].tables[]`) instead of relying only on flattened page text.

New file:

```text
apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts
```

Server action now extracts structured table rows and runs the structured IFFCO refiner after the existing text refiner. The structured pass rebuilds OD/TP/CPA from labeled premium rows and only returns them when the complete financial equation reconciles to printed net. If evidence is incomplete, financial fields are withheld rather than guessed.

Regression added:

```text
npm run policy-ocr:iffco-structured-regression
```

It covers the exact production-shaped bad state and the fail-safe missing-CPA case.

Relevant commits:

```text
a63604a773f5c2cdd5eaba08ada83cb0f125daec
6e3b37af37b254de367707f5d99cad96816c997b
f16058c0c159ec90f46d4b28a718d3205ab82a7b
1b5a19e8a31e7a2c7acf62510e3dcb7de94fbbf2
22d62f0387368ff8d0f1725321e0a286b2b9f5df
```

## Immediate next step

Before any deployment, user/local environment should run:

```text
npm run policy-ocr:iffco-structured-regression
npm run policy-ocr:iffco-regression
npm run policy-ocr:digit-regression
npm run policy-ocr:new-india-regression
npm run typecheck
npm run lint
npm run build
```

If these pass, wait for explicit deployment approval. After deployment, upload the same IFFCO file and verify OD `15042`, TP `7367`, CPA `330`. If Google returns no usable structured table rows, preserve Review Required and inspect sanitized structural evidence; do not add another proximity-based numeric guess.

United India remains deferred.
