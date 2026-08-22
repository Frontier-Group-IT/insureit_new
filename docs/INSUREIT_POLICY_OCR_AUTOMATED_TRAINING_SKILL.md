# INSUREIT Policy OCR Automated Training Skill

> Repository copy consolidated: 2026-08-22 (IST)
>
> Purpose: durable operating method for improving, training, debugging, validating, and extending INSUREIT motor-policy OCR. This repository copy is the preferred training skill for repository work. Historical File Library copies may contain useful detail, but current `main`, `AGENTS.md`, the dedicated OCR handoff, and this file take precedence.
>
> Never store credentials, raw policy documents, complete raw OCR text, customer/policyholder PII, or real registration/chassis/engine/policy identifiers in this file or reusable fixtures.

## 1. Core principle

Google Document AI is the **reading layer**. INSUREIT is the **interpretation layer**.

Training means improving INSUREIT's:

- current-policy insurer detection;
- insurer + product/layout routing;
- structured table interpretation;
- semantic normalization;
- accounting reconciliation;
- confidence/withholding rules;
- privacy-safe regression coverage;
- fresh-sibling generalization.

Training does **not** mean memorizing one uploaded policy, blindly trusting Google OCR, or blindly trusting a database reference.

## 2. Source-of-truth hierarchy

For a training comparison, use this order:

1. **Actual policy PDF/document** for what the policy says.
2. Current insurer/product/layout semantics approved by INSUREIT.
3. Current `main` parser/refiner behavior and dedicated OCR handoff.
4. Google Document AI output as OCR evidence.
5. Verified/database reference as a comparison source, not an unquestionable truth.
6. Historical training notes/chat only when they do not conflict with newer evidence.

### Mandatory PDF-final-truth rule

If the verified/database reference conflicts with the actual policy PDF, **the PDF wins**.

Do not train the conflicting database value into parser logic. Mark it as a reference conflict/review issue. A database row being approved or verified does not make a semantically wrong value valid training truth.

## 3. Approved OCR boundaries

Policy OCR may propose only fields approved by the current Policy Onboarding product contract. Current repository guidance allows approved visible vehicle/policy fields for explicit review and Section 03 policy/premium fields.

Never learn or reuse personal identity from training documents. Customer/insured names, phone, email, address, PAN, GSTIN and unrelated identity data are prohibited training material.

Registration, chassis, engine and policy identifiers may be used only in protected per-request/reference comparison where required. Reusable candidates, fixtures, logs and source control must replace them with synthetic values.

Review-before-apply remains mandatory. OCR proposals must never silently overwrite saved/manual form data.

## 4. Architecture: insurer first, layout second

The durable routing architecture is:

```text
current policy header
  -> current insurer family
  -> insurer-specific product/document layout
  -> layout-specific vehicle + policy + premium parser
  -> financial/semantic sanity gate
  -> review proposal
```

### Do not use one broad parser per insurer

The same insurer can publish materially different policy documents. Treat different products/layouts separately when labels, tables, periods, or financial semantics differ.

Typical separate families include:

- Package / Comprehensive;
- Standalone Own Damage (SAOD);
- Liability Only / Third Party;
- GCV / PCV / PCP / TWP;
- long-term bundled products;
- bilingual schedules;
- insurer-specific commercial/three-wheeler variants.

A parser existing for one layout does **not** mean the insurer is fully supported.

## 5. Current-policy insurer identity is a hard gate

Current insurer detection must prefer insurer evidence in the current policy header/page-one schedule.

The following must **not** hijack routing:

- previous-policy insurer;
- active/existing TP insurer printed inside an SAOD policy;
- broker text;
- footer/legal wording from another company;
- policy history or renewal references;
- unrelated embedded insurance references.

If the current insurer/layout cannot be proven, withhold layout-specific interpretation and require review rather than force the document into the closest parser.

## 6. The most important 22-policy learning: structure beats proximity

The 2026-08 multi-insurer training rounds showed that the remaining errors were mostly **table label/value association errors**, not raw character-recognition failures.

Do not use a global rule equivalent to:

> find a label, then take the next plausible token/number.

That approach repeatedly promotes:

- neighboring table headings;
- the next column's value;
- percentages;
- IMT/SAC/reference codes;
- coverage limits;
- engine/chassis IDs;
- row indices;
- previous-policy data.

Preferred approach:

1. identify insurer + layout;
2. identify the expected table/block;
3. map stable row/column relationships for that layout;
4. use exact/known label aliases;
5. use a small bounded text fallback only when structured rows are unavailable;
6. reconcile the result before accepting it.

Bilingual layouts need dedicated aliases and row mapping. Do not treat translated labels as noise around an English generic regex.

## 7. Vehicle-field lessons

Vehicle make/model/fuel/RTO were among the least consistent fields in the 22-policy reruns.

### Required rules

- Prefer layout-specific vehicle-table columns.
- Reject labels/headings as values.
- Normalize make/model only after real value evidence is found.
- Keep engine/chassis/registration extraction bounded and shape-validated.
- Prevent engine + chassis concatenation.
- Derive vehicle class from the proven product/layout family when that is more reliable than flattened OCR ordering.
- RTO normalization must come from RTO/registration evidence, not an arbitrary place name elsewhere in the policy.

### Known unsafe heading fragments

Reject values that are only structural text such as:

- `Model Type of`;
- `& Variant`;
- `Year of Mfg`;
- `Vehicle Registration No.`;
- `Insured & Vehicle Details`;
- `(if any)`;
- section/table labels;
- `Type of Body` when it is a header, not the requested value.

Do not create insurer-specific hardcoded customer/vehicle values to fix these errors.

## 8. Premium and accounting model

Treat premium interpretation as accounting, not number matching.

Conceptually distinguish:

- OD premium;
- Basic TP premium;
- owner-driver CPA/PA premium;
- non-owner liability additions such as paid driver/workmen/passenger liability;
- printed net premium;
- GST/tax;
- printed gross/total payable.

### Required reconciliation checks

Where the layout exposes the components, prove the relationship before accepting the fields.

Examples:

```text
OD + TP + owner-driver CPA / approved additions ~= printed net
printed net + tax ~= gross / total payable
```

Use the insurer/layout's actual printed semantics; do not force every insurer into one equation when the printed TP subtotal already includes selected additions.

### Hard financial guards

Reject or withhold results when:

- a liability addition becomes negative;
- TP is implausibly greater than net/gross without explicit evidence;
- a value cannot reconcile to printed totals within reasonable printed rounding tolerance;
- a percentage/code/table token is being used as premium;
- an IDV/coverage-limit-sized value is promoted into a small premium field without explicit row evidence.

Known dangerous numeric contexts include `5`, `9`, `18`, `25`, `28`, `75`, `100`, GST rates, NCB percentages, IMT numbers, SAC codes, table indices and coverage limits.

## 9. Liability-only and SAOD invariants

For a current **Liability Only / Third Party** policy:

- IDV = 0 unless the actual approved product semantics say otherwise;
- OD premium = 0;
- extract the current liability premium from the current policy;
- do not infer OD from another referenced policy.

For a current **SAOD** policy:

- current TP premium = 0 for the SAOD contract;
- an active/existing TP policy printed in the document is a reference, not the current policy premium;
- total IDV may need to be reconstructed from component IDVs if the schedule prints components separately.

## 10. CPA semantics learned from real insurer layouts

`cpa_opted = Yes` only when there is explicit owner-driver PA/CPA evidence for the current policy.

Use these rules:

- explicit positive owner-driver PA/CPA premium -> `Yes`;
- explicit zero, `No`, removed, not opted, or not provided -> `No`;
- paid-driver/workmen/passenger liability additions do **not** imply owner-driver CPA;
- a coverage limit such as owner-driver CSI is not the premium amount;
- do not infer CPA from a generic liability subtotal.

### Legacy `cpa_premium` compatibility warning

Some legacy portal behavior may use `cpa_premium` to preserve non-owner liability additions for accounting compatibility. If that compatibility is retained, it must **never** automatically set `cpa_opted = Yes`.

Treat the boolean semantic and the legacy accounting bucket as separate concepts.

## 11. Tax extraction lessons

Many policies split GST across rows.

Where applicable:

- sum `CGST + SGST/UTGST`;
- sum split IGST components when the insurer taxes different premium components at different rates;
- use printed total tax when explicitly labeled and trustworthy;
- if direct tax OCR is unsafe but printed net and gross are reliable, derive tax only when that fallback is approved and clearly evidenced.

Never use the tax **rate** (`5`, `9`, `18`) as the tax **amount**.

## 12. Rounding-equivalent comparison

The comparison/training evaluator must distinguish a real parser error from printed rounding.

Examples such as whole-rupee totals versus an underlying decimal calculation can be **rounding-equivalent** when the policy itself prints the rounded value.

Do not spend parser training effort trying to force a mathematically derived decimal when the actual policy PDF prints the rounded amount. The PDF remains final truth.

Recommended comparison statuses include:

- `MATCH_ALL` / exact match;
- `ROUNDING_EQUIVALENT`;
- `OCR_MISSING`;
- `TABLE_ASSOCIATION_ERROR`;
- `SEMANTIC_ERROR`;
- `REFERENCE_CONFLICT`;
- `INSUFFICIENT_EVIDENCE`.

## 13. Do not overfit the trained copy

A trained policy improving is **not proof of generalization**.

The repeated live observation was:

> the exact trained copy can perform better than a fresh policy from the same insurer/layout.

Therefore every supported layout should have at least:

- one sanitized fixture representing the originally failing/trained shape; and
- one **fresh sibling** fixture with changed identifiers, dates, vehicle values, premium values, and—where possible—slightly changed row ordering/spacing.

Prefer two or more representative real samples before describing support as broad.

A layout is not considered robust merely because the fixture from which its regex was derived passes.

## 14. Privacy-safe regression rules

Never commit:

- raw policy PDF/image;
- full OCR response;
- complete OCR text dump;
- real customer/policyholder name;
- phone/email/address;
- PAN/GSTIN;
- real policy number;
- real registration/chassis/engine;
- real customer IDs;
- credentials/tokens/auth responses.

A sanitized fixture may keep only what is necessary to reproduce parser behavior:

- insurer/product/layout wording;
- deterministic synthetic identifiers preserving format;
- test dates;
- IDV/premium/tax/gross values required for the accounting case;
- sanitized table headings/rows;
- synthetic non-identifying make/model/vehicle values where needed.

Every production failure worth fixing should become a sanitized regression reproducing the **failure shape**, not a copy of the customer's document.

## 15. Training comparison workflow

For each training round:

1. Inspect current `main`, `AGENTS.md`, this skill, the OCR handoff, current parser/refiners, package commands and CI workflow.
2. Read the latest verified/rerun training rows from the approved training store **read-only** unless the user explicitly authorizes a write.
3. Match each training row to the actual policy PDF.
4. Independently read the PDF for ground truth.
5. Compare **Database Reference vs Google/INSUREIT Result vs PDF Truth** field by field.
6. Mark reference conflicts; do not teach them.
7. Classify failures by cause, not only by field name.
8. Group failures by insurer + layout family.
9. Fix the highest-reuse structural rule first.
10. Add privacy-safe trained + fresh-sibling regressions.
11. Run the full canonical GitHub gate on the exact feature head.
12. Merge only with user approval.
13. Deploy only with explicit user approval/current release workflow.
14. Rerun the same corpus plus fresh sibling policies after deployment.
15. Measure live results before claiming an accuracy target.

## 16. Failure classification before coding

Before changing parser code, decide which problem you are solving:

- insurer-routing failure;
- product/layout-routing failure;
- raw OCR/text missing;
- table row/column association failure;
- normalization failure;
- policy-period selection failure;
- current-policy vs previous/external-policy confusion;
- CPA semantic failure;
- financial reconciliation failure;
- vehicle identifier contamination/concatenation;
- database/reference conflict;
- rounding-only difference;
- insufficient document evidence.

Do not solve a reference conflict with parser code. Do not solve a table-layout problem with a global permissive regex.

## 17. Insurer/layout coverage matrix

Maintain coverage conceptually as:

```text
Insurer | Layout family | Representative samples | PDF ground truth | Regression | Fresh sibling | Live retest | Known gaps
```

Current observed families from the 22-policy phase include variants such as:

- United India GCV Package;
- United India PCV Package;
- United India motorized 3W Liability Only;
- National GCV Package/bilingual schedule;
- National Private Car Liability Only;
- National Long-Term Two-Wheeler Bundled;
- HDFC ERGO Private Car Package/Comprehensive;
- HDFC ERGO Two-Wheeler SAOD;
- HDFC ERGO Two-Wheeler Liability Only;
- Magma Private Car Package;
- Magma Private Car SAOD;
- Magma Commercial Vehicle Liability Only;
- Digit Private Car Package;
- New India Private Car SAOD;
- Royal Sundaram Liability Only;
- Shriram liability/third-party layout represented in the current corpus.

This list is **observed layout coverage**, not a claim that all documents from those insurers are supported.

## 18. When to add more PDFs

Do not keep adding samples while a known architectural failure dominates many policies.

If multiple policies fail because the same table-association rule is wrong, fix that structural issue first, deploy, and rerun. More documents are useful after the parser is ready to test generalization, not as a substitute for correcting the architecture.

## 19. CI and branch discipline

OCR refinement work uses a dedicated feature branch, for example:

```text
ocr-training/<insurer-or-corpus>-<failure-or-layout>
```

The canonical gate is `.github/workflows/verify-web-portal.yml`.

Always inspect the current workflow because commands evolve. The full gate should protect:

- all existing OCR regressions;
- the latest production-rerun/fresh-sibling regression set;
- Policy Onboarding OCR import regression;
- OCR training workflow regression;
- TypeScript typecheck;
- lint;
- production build.

Do not declare readiness because one targeted regression passes. Do not weaken an existing insurer path to make a new layout pass.

## 20. Evidence-state language

Use precise states:

- **VERIFIED** — directly observed in source/schema/log/test/environment;
- **IMPLEMENTED** — committed code, not automatically deployed;
- **DEPLOYED** — exact release reached successful target deployment;
- **LIVE VERIFIED** — real authenticated upload/review result checked after deployment;
- **USER-REPORTED** — result reported by the user but not independently measured by the agent;
- **LEARNING** — durable root-cause rule;
- **BLOCKED** — named dependency prevents completion.

Never claim `90–95%` merely because synthetic CI is green.

## 21. 22-policy phase outcome and interpretation

### USER-REPORTED result — 2026-08-22

After the v5/v6 insurer-layout refinements, the user reported approximately **70–75% successful field extraction** across the trained/retested policy corpus.

Treat this as meaningful improvement, not completion.

The important interpretation is:

- insurer/layout routing became substantially more consistent;
- structural table mapping and financial sanity guards improved repeatability;
- exact trained copies improved;
- fresh same-layout policies still require continued generalization work;
- vehicle make/model/fuel/RTO and some insurer-specific financial rows remain the main path toward the 90–95% target.

Do not record 70–75% as a laboratory benchmark unless a later field-by-field metric is computed from a defined denominator.

## 22. Recent implementation landmarks

Useful OCR training landmarks; inspect current `main` before relying on them:

- PR #548 — 22-policy insurer/layout training increment; merged into `main` as `1a8acf8f036f1b4f3671616f54c7e3600e1344b9`.
- PR #550 — structural refinement after the 22-policy rerun; exact verified feature head `b965ce8fada746d071b88cf9ce9dd36ec5e8e711`; canonical Verify web portal run #1645 / `32568214383` succeeded; merged as `e857ec41385671ee1901519bc2c4662f7de8fd55`.

PR #550 added/strengthened:

- current-insurer header hard gating;
- dedicated Shriram current-policy route;
- UIIC/National/HDFC/Digit/New India/Royal/Magma layout-specific handling;
- split-GST handling;
- vehicle heading/value guards;
- financial sanity checks;
- fresh sibling regressions.

These commits prove implementation/CI history, not universal insurer accuracy.

## 23. Next-stage acceptance target

The user's target remains roughly **90–95% correct fields** across representative live policy copies.

Before claiming that level:

1. define the field denominator and which fields count;
2. exclude/label reference conflicts and rounding-equivalent cases separately;
3. test both trained and fresh sibling copies;
4. include multiple layouts per insurer where they exist;
5. measure the actual live post-deployment results;
6. retain safe withholding as a correct outcome when evidence is insufficient.

Accuracy must not be increased by filling uncertain fields with guesses.

## 24. Compact agent directive

> Act as the INSUREIT Policy OCR training engineer. Treat the actual policy PDF as final ground truth, Google Document AI as the reading layer, and INSUREIT insurer/layout-specific parsers as the semantic layer. Route by current insurer header first, then by product/layout. Prefer structured table relationships and bounded fallbacks over proximity regex. Reconcile financials, separate owner-driver CPA from other liability additions, reject unsafe tokens/headings, and withhold uncertain fields. Train with privacy-safe synthetic regressions plus fresh sibling cases. Never teach a conflicting database reference, never commit real policy/vehicle/customer identity, and never claim an accuracy target until live reruns prove it.
