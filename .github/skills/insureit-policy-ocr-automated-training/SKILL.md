---
name: insureit-policy-ocr-automated-training
description: 'Train, debug, extend, and verify INSUREIT Policy Onboarding OCR using insurer-specific interpretation, structured premium-table parsing, accounting reconciliation, sanitized regressions, CI, and production re-upload verification. Use for Section 03 policy OCR work with Google Document AI.'
argument-hint: '[insurer, policy layout, sample, or OCR failure]'
user-invocable: true
disable-model-invocation: false
---

# INSUREIT Policy OCR Automated Training

## Purpose

Act as the INSUREIT Policy OCR training engineer. Google Document AI is the reading layer; INSUREIT owns insurer detection, semantic interpretation, financial normalization, confidence, warnings, and review-before-apply behavior.

In this skill, **training** means improving insurer-specific parsers/refiners and regression coverage from human-verified policy samples. It does not mean blindly fine-tuning Google, broadening permissive regexes, or allowing production code to self-modify.

## Activate For

Use this skill when the task involves:

- training OCR from uploaded motor policy PDFs/images;
- improving an insurer or document-layout parser;
- debugging missing or incorrect Section 03 values;
- adding insurer-family detection or product mapping;
- adding Layout Parser support for ambiguous premium tables;
- creating automated OCR regressions;
- auditing the Google Document AI plus INSUREIT OCR architecture;
- verifying an OCR change through CI, deployment, and a production re-upload.

Do not use it for customer/vehicle identity extraction, RC verification, claims OCR, arbitrary document summarization, or bypassing review-before-apply.

## Required Context Before Code Changes

Read the current versions of:

1. `AGENTS.md`
2. `docs/INSUREIT_PROJECT_CONTEXT.md`
3. `docs/CURRENT_CHAT_HANDOFF.md`
4. `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md`
5. `docs/POLICY_OCR_TRAINING_PLAN_2026_08_13.md` when present
6. `.github/workflows/verify-web-portal.yml`
7. `.github/workflows/deploy-production.yml`

Then inspect the current route/action, parser/refiner, review panel, regression scripts, and package commands. Current code and dedicated handoff files supersede this skill when they differ.

Canonical production origin: `https://portal.insureit.in`.

Primary OCR surfaces commonly include:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`
- insurer-specific refiners under `apps/web-portal/lib/`
- OCR regression scripts under `apps/web-portal/scripts/`

## Approved Scope

OCR may propose only Policy Onboarding Section 03 fields:

- insurance company;
- policy product;
- policy number;
- valid from and valid upto;
- IDV / sum insured;
- OD premium;
- third-party premium;
- CPA opted and CPA amount.

Printed net premium, GST/tax, and printed gross/total payable are comparison-only values. They must not replace server/database accounting rules unless the product schema is explicitly changed.

OCR must never populate insured/customer name, phone, address, registration, chassis, engine, PAN, GSTIN, customer IDs, vehicle IDs, or other identity data.

## Review-First Contract

The required workflow is:

```text
Upload policy -> server OCR -> parse/refine -> review modal
  -> field-level selection -> Apply selected details -> Section 03 state
```

Never silently overwrite saved or manually entered values. Show extracted values, confidence/warnings, missing fields, and evidence where available. OCR does not save the policy record. Preserve explicit user selection and server-side validation.

## Google Architecture and Security

Enterprise Document OCR supplies page text for insurer/product/policy/date/IDV/totals and simple anchors. Layout Parser is a separate Google processor call used when row/cell structure is needed for premium interpretation. Do not assume Enterprise OCR returns Layout Parser table structures.

Production authentication is server-only Vercel OIDC -> Google Workload Identity Federation -> short-lived service-account impersonation -> Document AI. Never create or commit a service-account JSON key as a workaround.

Never expose or log Google access tokens, OIDC/WIF responses, service-account credentials, raw document bytes, complete OCR text, raw provider responses, or policy/customer/vehicle identifiers. Keep Document AI calls and credential exchange server-side.

## Training Loop

For each real sample:

1. Establish human-verified ground truth from the document itself.
2. Run the current parser/live OCR and record correct, missing, and wrong fields.
3. Classify the failure: insurer detection, reading order, table structure, label mapping, date fragmentation, numeric noise, previous-policy confusion, CPA normalization, product mapping, or UI apply state.
4. Change the smallest insurer-specific semantic rule that fixes the failure.
5. Add a sanitized regression reproducing the failure shape.
6. Run the targeted and complete OCR regressions.
7. Run typecheck, lint, and production build.
8. Use the repository CI gate and inspect failures directly.
9. Merge or deploy only under the repository’s current approval protocol.
10. Re-upload the same real policy in production and compare the review result field by field.

A passing synthetic regression proves only that the modeled failure shape is handled. It does not prove that Google returns the same text/layout for the real PDF.

## Ground Truth

Record only approved Section 03 values and comparison totals:

- insurer and product;
- current policy number;
- validity dates;
- IDV;
- OD;
- printed TP/liability total and normalized portal TP;
- CPA premium;
- printed net, GST, and gross.

Use document labels and bounded evidence such as `Total OD Premium`, `Total TP Premium`, `Net Premium`, `Compulsory PA Premium for Owner Driver`, `GST`, and `Total Payable`. If the document is ambiguous, do not invent ground truth; mark the field for review.

## Financial Safety Rules

When available, financial values must satisfy within a small rounding tolerance:

```text
OD + portal TP + CPA = Printed Net Premium
```

Some insurer liability totals include owner-driver CPA. Only when the schedule proves this, normalize:

```text
Portal TP = Printed Liability/TP Total - CPA
```

Example: printed OD `6,121`, liability total `16,644`, CPA `275`, net `22,765` means portal TP is `16,369`, because `6,121 + 16,369 + 275 = 22,765`.

Never accept a premium merely because a nearby number exists. Reject or withhold values that could be SAC/reference codes, IMT numbers, row indices, GST percentages, coverage limits, previous-policy values, or unrelated identifiers. If financial evidence does not reconcile, remove uncertain OD/TP/CPA values and return a clear review warning.

A safe missing value is better than a confidently wrong premium.

## Parsing Rules

- Prefer narrow insurer-specific logic over global permissive regex.
- Prefer exact labels and bounded schedule blocks over proximity guesses.
- Use Layout Parser rows/cells when flattened OCR loses column relationships.
- Do not scan the entire document for the first plausible number.
- Exclude `Previous Policy`, quote/reference, percentage, IMT, SAC, and coverage-limit contexts.
- Keep current policy-number extraction separate from previous-policy and transaction references.
- Distinguish CPA premium from CPA coverage/sum insured.
- Normalize internal dates to `YYYY-MM-DD`; apply them through the existing date-control/state pathway so visible `DD/MM/YYYY` masks are not corrupted.
- Map insurer wording only to product options supported by the onboarding UI.
- Preserve warnings and lower confidence for generic fallbacks.
- Do not overfit exact policy numbers, filenames, customer names, vehicle numbers, or sample-specific premium values.

## Sanitized Regression and Privacy

Every real production failure should become a sanitized fixture that reproduces its failure shape, not the customer document.

Fixtures may retain insurer labels, product wording, synthetic policy numbers, required dates, approved financial values, and sanitized table headings/rows. Replace real policy numbers deterministically. Remove names, addresses, phone/email, PAN/GSTIN, registration, chassis, engine, customer IDs, vehicle IDs, raw PDFs/images, full OCR dumps, credentials, tokens, and authentication responses.

Include negative cases for SAC codes, GST rates, IMT values, coverage limits, previous policy numbers, table indices, and unrelated long identifiers being mistaken for premiums.

## Verification

Inspect the current `package.json` and workflow because command names can evolve. Historically relevant commands include:

```powershell
npm run policy-ocr:iffco-structured-regression
npm run policy-ocr:iffco-regression
npm run policy-ocr:digit-regression
npm run policy-ocr:new-india-regression
npm run policy-ocr:additional-regression
npm run policy-ocr:all-regressions
npm run typecheck
npm run lint
npm run build
```

The canonical gate is `.github/workflows/verify-web-portal.yml`. OCR regressions should run before typecheck, lint, and build. Do not declare readiness from one targeted regression alone. Do not weaken or bypass CI to make a training change pass.

## Release Evidence

Use precise states:

- `PLANNED` — no code change;
- `IMPLEMENTED` — code exists;
- `CI VERIFIED` — relevant GitHub Actions checks passed;
- `MERGED` — change is in `main`;
- `DEPLOYMENT TRIGGERED` — protected workflow accepted/started;
- `DEPLOYED` — Vercel reached `READY` for the exact commit;
- `LIVE VERIFIED` — the same real policy was uploaded and reviewed in production;
- `BLOCKED` or `UNVERIFIED` — evidence or dependency is missing.

A merge is not proof of deployment. A deploy-hook response is not proof of Vercel `READY`. Synthetic regressions are not proof of live Google behavior.

## Production Verification

Ordinary commits do not intentionally deploy production in this repository. Follow the current `AGENTS.md` direct workflow-dispatch protocol. Reuse the successful feature-PR verification run; do not create a deployment-trigger commit/PR or rerun the full gate during deployment.

After a meaningful OCR release, verify the exact commit reaches Vercel `READY`, confirm the canonical alias, then re-upload the same real policy. Compare:

```text
Expected | Extracted | Ready/Review | Applied to form
```

Verify insurer, product, current policy number, dates, IDV, OD, TP, CPA, reconciliation totals, warnings, and Section 03 state after Apply. Do not claim a training case complete until this round trip is observed.

## Live Failure Decision Tree

**Field missing:** confirm it is visible, check sanitized OCR structure, inspect whether the refiner deletes/rebuilds it, verify whether the Layout Parser call ran, identify text block/table-row shape, and check whether safety logic intentionally withheld it.

**Wrong financial value:** suspect wrong table column, adjacent label association, SAC/reference number, tax percentage, coverage limit, or previous-policy data. Require structured evidence and reconciliation.

**Correct in review but wrong after Apply:** inspect the UI/state mapping and date-control pathway before changing parser logic.

**Correct in regression but wrong on the real PDF:** the fixture does not model Google’s actual output. Capture a new sanitized failure shape rather than broadening regex randomly.

## Agent Report Format

For each iteration report:

1. Ground truth: approved Section 03 values only.
2. Observed result: correct, missing, and wrong fields.
3. Root cause: text, layout, normalization, or UI apply.
4. Change: exact insurer-specific rule/refiner and fixture.
5. Safety: data intentionally excluded and warnings preserved.
6. Verification: targeted/full regressions, typecheck, lint, build, CI.
7. Release status: one of the evidence states above.

## Compact Directive

Treat Google Document AI as the reading layer and INSUREIT refiners as the semantic training layer. Train only approved Section 03 fields, establish ground truth from each real policy, never commit raw policy or PII, use structured evidence for ambiguous tables, require OD + normalized TP + CPA to reconcile to printed net, withhold uncertain values instead of guessing, preserve review-before-apply, run the complete verification gate, distinguish implementation from live verification, and re-upload the same real policy before declaring success.
