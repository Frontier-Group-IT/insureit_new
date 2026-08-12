# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

Policy Onboarding OCR hardening remains an active workstream. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

A separate master-data administration change was added on 2026-08-12: protected deletion controls for existing customers, vehicles, policies, and claims are available only to the `it_super_user` role in the Customers, Vehicles, Policies, and Claims registries. The customer/vehicle/policy controls were deployed to production earlier on 2026-08-12; the subsequent claim-delete extension is implemented and verified on `main` but is not yet deployed.

## IT Super User master-record and claim deletion controls

Implemented on `main` on 2026-08-12.

Files:

```text
apps/web-portal/app/master-record-delete-actions.ts
apps/web-portal/components/it-super-user-delete-panel.tsx
apps/web-portal/app/customers/page.tsx
apps/web-portal/app/vehicles/page.tsx
apps/web-portal/app/policies/page.tsx
apps/web-portal/app/claims/page.tsx
```

Security and behavior rules:

- The deletion panel renders only when the authenticated server profile role is exactly `it_super_user`.
- The server action independently re-authenticates and rejects every role except exact `it_super_user`; UI visibility is not the security boundary.
- Deletion uses the server-only Supabase admin client only after this exact role check.
- The UI requires selecting the exact record and typing `DELETE` before permanent deletion.
- Customer deletion is blocked while linked vehicles, policies, or claims exist.
- Vehicle deletion is blocked while linked policies or claims exist.
- Policy deletion is blocked while linked claims exist.
- Claims can now be explicitly deleted by `it_super_user` so the dependency chain can be cleared before deleting a policy, vehicle, or customer.
- Claim deletion deletes only the selected claim as the root record. Existing database `ON DELETE CASCADE` relationships remove linked `claim_documents` metadata, `claim_status_history`, `claim_tasks`, and `notifications`; the linked policy, vehicle, and customer remain intact.
- Before claim deletion, claim-document storage bucket/path metadata is collected. After the database delete succeeds, the server makes a best-effort cleanup of the corresponding stored files. A storage cleanup failure does not recreate the already-deleted claim.
- This prevents the existing `ON DELETE CASCADE` customer -> vehicle/policy and vehicle -> policy relationships from silently deleting dependent master data.
- A remaining database foreign-key reference is treated as a safe block rather than bypassed.
- Successful deletion writes an `audit_logs` entry with the actor, table, record id, and deletion source. Claim audit entries also note that claim-linked cascade rows were involved and how many storage-file cleanup attempts were made.
- Customer Auth/profile identities are intentionally not deleted by this feature; the request covered master records only. Auth identity removal must remain a separate explicit operation.
- No Supabase migration is required for this feature.
- Do not weaken customer/vehicle/policy dependency checks or convert them to cascade deletion without explicit product approval.

Original customer/vehicle/policy implementation commits:

```text
f928a951fbca0504499ebcfb2903203a94b2c19c
e23f0a98cb2b2f2af52823cf6c5b15aab89d9cba
bd0a8d6e57503552f14d5813b003acf683eac0de
2e1e7f907fbaac888941e5ffe0a1ecbb441163df
87e59f659c050d8d447d4f8a44a0dace8a5fac15
```

The original feature verification for head `87e59f659c050d8d447d4f8a44a0dace8a5fac15` was GitHub Actions run `31571721254`, result SUCCESS.

Production deployment of the original customer/vehicle/policy controls:

```text
Deployment trigger commit: 0b74c06dbeb678a55299c0ec3031645ba4a4412c
GitHub Actions production run: 31572246538
Vercel deployment: dpl_CaJm81BXrJ4FXpMUnya74ti33A6m
Production state: READY
Alias: portal.insureit.in
```

Claim-delete extension commits:

```text
a104a5ebf1d7bb93bedb42339fe02ff38c87c103
ed9549d35a46d43c2a36cd62a5686629804a3770
ae67335110df70884d4724005bcd39551b1bc7ce
```

Verification for claim-delete feature head `ae67335110df70884d4724005bcd39551b1bc7ce`:

```text
GitHub Actions workflow: Verify web portal
Run: 31573206603
Result: SUCCESS
Access Control V2 catalogue regression: passed
Access Control V2 scope/compatibility regression: passed
Access Control V2 portal lifecycle regression: passed
Employee portal governance regression: passed
IFFCO structured regression: passed
IFFCO regression: passed
Digit regression: passed
New India regression: passed
Typecheck: passed
Lint: passed
Production build: passed
```

No production deployment has been triggered for the claim-delete extension. Wait for explicit user approval before changing `.deploy/production-trigger.json`.

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

For OCR deployment, continue to follow the regression and explicit-deploy gate in `AGENTS.md`. For deletion administration, the complete dependency order is now: delete claim -> delete policy -> delete vehicle -> delete customer, with each step only when the user actually intends to remove that record. The claim-delete extension is verified green but must not be deployed until the user explicitly requests deployment.

United India remains deferred.
