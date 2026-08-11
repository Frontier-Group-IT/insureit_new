# Current Chat Handoff

> **Consolidated:** 2026-08-11 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

The isolated employee-assistant Preview on branch `agent/assistant-preview` / PR #249 is the immediate active work. Production portal is `https://portal.insureit.in`; no assistant work in this track is production-deployed. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

## Assistant Preview continuation state

- **USER-CONFIGURED / REDEPLOY PENDING:** Vercel Preview uses the OpenRouter OpenAI-compatible endpoint with a user-managed Preview-only key. The user restored `ASSISTANT_MODEL` to verified `google/gemma-4-26b-a4b-it:free` after `inclusionai/ling-3.0-tiny:free` returned HTTP 400 for the required tools plus structured-output request. Never store or repeat the key.
- **VERIFIED:** assistant provider connectivity works. The former Vercel AI Gateway path was blocked by `403 customer_verification_required`; direct OpenRouter Preview requests now return controlled assistant responses.
- **IMPLEMENTED:** provider requests require JSON output and log bounded provider error metadata only. Prompts, answers, keys, and provider bodies are not logged.
- **IMPLEMENTED:** exact greetings and ambiguous single-topic prompts are answered or clarified deterministically without model quota. Explicit navigation requests are resolved deterministically through the existing permission-aware catalogue; model output cannot grant routes.
- **IMPLEMENTED:** navigation aliases and scoring distinguish actions such as create/add/onboard from list/register requests for POSP, MISP, customers, vehicles, policies, claims, KYC, and tasks.
- **APPLIED (test project only):** migration `seed_assistant_starter_knowledge` is applied to Supabase project `jzuqlcysyqtyydukveir`. Five published, permission-scoped starter entries cover POSP onboarding, Policy Onboarding, claims, customer KYC, and task views. A direct permission-scoped RPC query returned the Policy Onboarding entry; count verification returned five active starter entries.
- **VERIFIED (implementation commit `dd4cbb5`):** GitHub Actions run `31471331526` passed the assistant/security regressions, OCR regressions, typecheck, lint, and production build. Vercel Preview deployment `dpl_7TJ1XXYC1o4YcXf8W1z8bjtvmJej` reached `READY`. Authenticated browser verification of the new greeting, clarification, navigation-ranking, and starter-knowledge journeys remains required.
- **CLEANUP REQUIRED AFTER TESTING:** remove/deactivate the temporary Preview deployment/configuration and testing resources as previously requested; do not touch production environments while doing so.

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
