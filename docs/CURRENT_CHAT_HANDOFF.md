# Current Chat Handoff

> **Consolidated:** 2026-08-12 (IST)
>
> Read with `docs/INSUREIT_PROJECT_CONTEXT.md` and `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`. Never store secrets, raw OCR text, policyholder PII, or complete policy documents here.

## Active track

The isolated employee-assistant Preview on branch `agent/assistant-preview` / PR #249 is the immediate active work. Production portal is `https://portal.insureit.in`; no assistant work in this track is production-deployed. Ordinary commits do not intentionally deploy production; `.deploy/production-trigger.json` is changed only after the user explicitly says `deploy now` or `finish and deploy`.

## Assistant Preview continuation state

- **VERIFIED (real-time baseline commit `034439be`):** GitHub Actions run `31564067821` passed and Vercel Preview deployment `dpl_8r1YYT62F5mkXNJoVXRuJHAtLPJA` reached `READY` at the branch alias. This baseline provides aggregate-only permission-scoped live metrics for POSP/MISP/Partner, customers, vehicles, policies, claims and tasks; it never returns raw record data to the model.
- **VERIFIED (expanded assistant commit `433d26fd`):** common typo correction, deterministic capabilities/help responses, conversational follow-up context, intent-based knowledge-search fallback, category-filtered Group/Corporate/Dealership/Individual Proprietor customer counts, and broader workflow/customer-service knowledge are implemented. GitHub Actions run `31565350562` passed assistant/security regressions, all required OCR regressions, typecheck, lint and the production build. Vercel deployment for the exact commit completed successfully at `https://insureit-8dwjdau34-antnish1s-projects.vercel.app`. Authenticated browser verification remains required. Never store or repeat the user-managed Preview OpenRouter key.
- **IMPLEMENTED / PREVIEW VERIFICATION PENDING:** the reasoning upgrade replaces verbatim first-source answers with multi-source model synthesis, adds effective-permission diagnostics for missing menu/actions, allows bounded general insurance/customer-service explanations, supplies permitted destinations alongside knowledge, and removes raw source UUIDs from conversational text. The exact screenshot question about a missing Add Policy menu now resolves against `view_policies` edit access. Local typecheck, assistant regressions and lint pass; canonical CI and the resulting Preview deployment remain pending.
- **IMPLEMENTED / COMBINED CI PENDING:** the training foundation is now integrated into the running OpenRouter assistant architecture. `apps/web-portal/lib/assistant/constitution.ts` is the versioned runtime system prompt used by the orchestrator, and `apps/web-portal/training/evals/foundation.jsonl` contains 26 contract evaluations across 12 categories. `assistant:training-regression` validates constitution safety coverage and benchmark structure and is included in the compulsory `assistant:regression` chain. The training regression and full assistant suite passed before replay onto the latest Preview tip; the combined checkout could not install a second dependency tree locally because the disk reported `ENOSPC`, so canonical GitHub Actions remains the required combined verification. The foundation benchmark is a contract dataset, not yet a live-model quality score.
- **USER-CONFIGURED / VERIFIED PREVIEW PROVIDER; BEHAVIOR FIX PENDING DEPLOYMENT:** Vercel Preview uses the OpenRouter OpenAI-compatible endpoint with a user-managed Preview-only key and restored `google/gemma-4-26b-a4b-it:free`. Ling returned HTTP 400 for the required tools plus structured-output request. Gemma is allowed up to 30 seconds within a 45-second route ceiling. Because the free model did not reliably invoke approved-knowledge tools, explicit procedure questions now use a deterministic permission-scoped knowledge lookup; unsupported live-count questions return a controlled limitation plus the relevant permitted register link instead of calling the provider. Local typecheck and all assistant regressions pass; Preview deployment and authenticated retest remain pending. Never store or repeat the key.
- **VERIFIED:** assistant provider connectivity works. The former Vercel AI Gateway path was blocked by `403 customer_verification_required`; direct OpenRouter Preview requests now return controlled assistant responses.
- **IMPLEMENTED:** provider requests require JSON output and log bounded provider error metadata only. Prompts, answers, keys, and provider bodies are not logged.
- **IMPLEMENTED:** exact greetings and ambiguous single-topic prompts are answered or clarified deterministically without model quota. Explicit navigation requests are resolved deterministically through the existing permission-aware catalogue; model output cannot grant routes.
- **IMPLEMENTED:** navigation aliases and scoring distinguish actions such as create/add/onboard from list/register requests for POSP, MISP, customers, vehicles, policies, claims, KYC, and tasks.
- **APPLIED (test project only):** migrations `seed_assistant_starter_knowledge` and `expand_assistant_workflow_and_customer_service_knowledge` are applied to Supabase project `jzuqlcysyqtyydukveir`. Nineteen published, permission-scoped entries now cover assistant capabilities, POSP/MISP/Partner meanings and onboarding, customer onboarding/KYC/review, policies/renewals/OCR, claims and replacement documents, vehicles/fleet, tasks and forgot-password support. Direct permission-scoped RPC searches verified representative POSP, password, capabilities, customer-onboarding and claim-document results.
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
