# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

Policy Onboarding OCR hardening remains an active workstream. Production portal is `https://portal.insureit.in`. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

A separate master-data administration change was added on 2026-08-12: protected deletion controls for existing customers, vehicles, and policies are now available only to the `it_super_user` role in the Customers, Vehicles, and Policies registries.

## IT Super User master-record deletion controls

Implemented on `main` on 2026-08-12.

Files:

```text
apps/web-portal/app/master-record-delete-actions.ts
apps/web-portal/components/it-super-user-delete-panel.tsx
apps/web-portal/app/customers/page.tsx
apps/web-portal/app/vehicles/page.tsx
apps/web-portal/app/policies/page.tsx
```

Security and behavior rules:

- The deletion panel renders only when the authenticated server profile role is exactly `it_super_user`.
- The server action independently re-authenticates and rejects every role except exact `it_super_user`; UI visibility is not the security boundary.
- Deletion uses the server-only Supabase admin client only after this exact role check.
- The UI requires selecting the exact record and typing `DELETE` before permanent deletion.
- Customer deletion is blocked while linked vehicles, policies, or claims exist.
- Vehicle deletion is blocked while linked policies or claims exist.
- Policy deletion is blocked while linked claims exist.
- This prevents the existing `ON DELETE CASCADE` customer -> vehicle/policy and vehicle -> policy relationships from silently deleting dependent master data.
- A remaining database foreign-key reference is treated as a safe block rather than bypassed.
- Successful deletion writes an `audit_logs` entry with the actor, table, record id, and deletion source.
- Customer Auth/profile identities are intentionally not deleted by this feature; the request covered master records only. Auth identity removal must remain a separate explicit operation.
- No Supabase migration is required for this feature.
- Do not weaken these dependency checks or convert them to cascade deletion without explicit product approval.

Implementation commits in this sequence:

```text
f928a951fbca0504499ebcfb2903203a94b2c19c
 e23f0a98cb2b2f2af52823cf6c5b15aab89d9cba
 bd0a8d6e57503552f14d5813b003acf683eac0de
 2e1e7f907fbaac888941e5ffe0a1ecbb441163df
 87e59f659c050d8d447d4f8a44a0dace8a5fac15
```

The GitHub `Verify web portal` workflow for head `87e59f659c050d8d447d4f8a44a0dace8a5fac15` passed access-control regressions, OCR regressions, TypeScript, and lint; production build was still running when this handoff section was written. Re-check workflow run `31571721254` before calling verification complete.

No production deployment was triggered by this work.

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

For OCR deployment, continue to follow the regression and explicit-deploy gate in `AGENTS.md`. For the master-record delete feature, first confirm the latest `Verify web portal` workflow is green; then wait for explicit deployment approval. After deployment, test with disposable dependency-free records and separately verify that customer/vehicle/policy records with linked dependencies are rejected with a clear message.

United India remains deferred.
