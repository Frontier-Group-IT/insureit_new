# Policy OCR Training Plan - Multi-Insurer Policy Copies

> Created: 2026-08-13
>
> Major revision: 2026-08-22 after the 22-policy insurer/layout training and live rerun phase.
>
> Scope: improve Policy Onboarding OCR accuracy while preserving Google Document AI as the reading layer, insurer/layout-specific INSUREIT interpretation, review-before-apply, privacy-safe training, and the current approved Policy Onboarding field boundary.
>
> Detailed method: `docs/INSUREIT_POLICY_OCR_AUTOMATED_TRAINING_SKILL.md`
>
> Latest training continuation: `docs/POLICY_OCR_TRAINING_HANDOFF_2026_08_22.md`
>
> Never store raw OCR text, complete policy copies, policyholder/customer PII, real vehicle identifiers, real policy numbers, PAN/GSTIN, phone/email/address, credentials, tokens, or decrypted provider data in this file or reusable fixtures.

## 1. Objective

Make policy-copy reading reliable across representative insurer **and document-layout families**, not merely across a list of insurer names.

The correct interpretation of training is:

- keep Google Document AI as the OCR/layout reading layer;
- use the actual policy PDF as final ground truth when a verified/database reference conflicts;
- train INSUREIT through current-insurer detection, insurer + layout routing, structured table mapping, semantic normalization, accounting reconciliation, confidence/withholding rules and privacy-safe regressions;
- test both the originally trained copy and fresh same-layout siblings;
- withhold uncertain values instead of guessing;
- preserve review-before-apply.

## 2. Current result and target

### USER-REPORTED — 2026-08-22

After the v5/v6 22-policy refinement and rerun, the user reported approximately **70–75% successful extraction**.

This is not a formal benchmark. Do not quote it as a measured field-accuracy score unless a later evaluator defines the denominator and separates:

- exact matches;
- rounding-equivalent values;
- reference conflicts where the database is wrong;
- safely withheld fields;
- genuine parser errors.

The working product target remains approximately **90–95% correct fields** across representative live policy copies without increasing unsafe guesses.

## 3. Durable source-of-truth rule

For training comparisons:

```text
Actual policy PDF > approved semantic rule > current parser/handoff > Google OCR evidence > database/reference row
```

If a verified/database reference conflicts with the PDF:

- classify it as a reference conflict;
- do not teach it to the parser;
- do not reduce a PDF-correct parser result merely to match the bad reference.

## 4. Parser architecture

The required architecture is:

```text
current policy header
 -> current insurer family
 -> insurer-specific product/document layout
 -> layout-specific field/table parser
 -> semantic + financial sanity gate
 -> review proposal
```

### Current-insurer gate

Insurer detection must prefer the current policy header/page-one schedule. Previous insurer, active/existing TP insurer, broker references, footer text and historical policy references must not hijack the current parser.

### Layout families

Do not treat one insurer parser as universal. Create separate handling whenever layout/product semantics differ, including where applicable:

- Package / Comprehensive;
- SAOD;
- Liability Only / Third Party;
- GCV / PCV / PCP / TWP;
- long-term bundled products;
- bilingual schedules;
- three-wheeler/commercial variants.

## 5. Current observed training matrix

The latest 22-policy phase contains or refines families including:

| Insurer | Observed layout family |
| --- | --- |
| United India | GCV Package |
| United India | PCV Package |
| United India | Motorized 3W Liability Only |
| National | GCV Package / bilingual schedule |
| National | Private Car Liability Only |
| National | Long-Term Two-Wheeler Bundled |
| HDFC ERGO | Private Car Package / Comprehensive |
| HDFC ERGO | Two-Wheeler SAOD |
| HDFC ERGO | Two-Wheeler Liability Only |
| Magma | Private Car Package |
| Magma | Private Car SAOD |
| Magma | Commercial Vehicle Liability Only |
| Digit | Private Car Package |
| New India | Private Car SAOD |
| Royal Sundaram | Liability Only |
| Shriram | Current-policy liability/third-party layout represented in corpus |

This is observed layout coverage, **not** universal insurer support.

Historical IFFCO and other supported families remain protected by the full regression suite; inspect current `main` before changing exact family IDs or command names.

## 6. Training data rules

For each real insurer sample:

1. Run/read Google Document AI output through the existing production/training workflow.
2. Independently inspect the actual PDF for ground truth.
3. Compare Database Reference vs Google/INSUREIT Result vs PDF Truth.
4. Save only sanitized synthetic regression evidence.
5. Replace identifiers with deterministic synthetic values preserving format.
6. Retain only the labels/tables/numbers required to reproduce the parser failure.
7. Record which labeled row/table proves each financial value.

Never commit the uploaded PDF or a full OCR dump.

## 7. Failure classification before coding

Every mismatch should be classified before changing parser logic:

- current-insurer routing failure;
- product/layout routing failure;
- raw OCR/text missing;
- table row/column association failure;
- value normalization failure;
- current vs previous/external policy confusion;
- policy-period selection failure;
- vehicle identifier contamination/concatenation;
- CPA semantic failure;
- financial reconciliation failure;
- database/reference conflict;
- rounding-equivalent difference;
- insufficient evidence.

Do not solve a reference conflict with parser code. Do not solve a table-layout problem with a global permissive regex.

## 8. Structural extraction plan

### Phase A — Insurer and layout routing

Acceptance:

- current insurer comes from current-policy header evidence;
- previous/external insurer text cannot hijack routing;
- each known layout maps to the intended layout parser;
- unknown layouts fail safely rather than borrowing the closest parser.

### Phase B — Layout-specific vehicle tables

The 22-policy rerun showed make/model/fuel/RTO and some engine/chassis associations as major remaining weak points.

For each layout:

- define expected table columns/row aliases;
- reject headings as values;
- validate registration/chassis/engine shape and length;
- prevent concatenated identifiers;
- normalize make/model only after real evidence;
- derive vehicle class from layout when more reliable than OCR order;
- anchor RTO to registration/RTO evidence.

Reject structural fragments such as `Model Type of`, `& Variant`, `Year of Mfg`, `Vehicle Registration No.`, `Insured & Vehicle Details`, `(if any)` and section headings when returned as values.

### Phase C — Layout-specific policy identity and periods

Extract:

- current policy number, excluding previous/active TP references;
- current policy period appropriate to the product;
- SAOD OD period vs referenced TP period;
- bundled OD vs long-term liability period according to the current Policy Onboarding field semantics.

### Phase D — Layout-specific financials

Interpret separately:

- OD;
- Basic TP;
- owner-driver CPA/PA;
- other liability additions;
- printed net;
- GST/tax;
- gross/total payable.

Use table relationships and accounting reconciliation, not first-nearby-number extraction.

## 9. Financial safety rules

### Reconciliation

Where present, prove the insurer/layout's printed accounting relationships before accepting financial fields.

Use net/tax/gross as independent checks. If a company's liability subtotal includes CPA or other additions, normalize according to the approved current schema instead of double counting.

### Hard guards

Reject or withhold values when:

- liability addition is negative;
- TP is implausibly above net/gross without explicit evidence;
- components do not reconcile within reasonable printed rounding tolerance;
- a percentage/code/index is promoted into an amount;
- a coverage-limit/IDV-sized value is being used as a small premium without explicit row evidence.

Dangerous contexts include GST rates `5/9/18`, NCB percentages, IMT numbers such as `25/28`, SAC/reference codes, table indices and owner-driver coverage limits.

### Tax

Where required, sum actual split tax amounts:

- CGST + SGST/UTGST;
- split IGST components.

Never use the tax rate as the tax amount.

## 10. CPA normalization plan

CPA is owner-driver PA/CPA semantics, not a synonym for every liability addition.

Rules:

- explicit positive owner-driver premium -> `cpa_opted = Yes`;
- explicit zero/No/removed/not opted/not provided -> `No`;
- paid-driver/workmen/passenger additions do not imply owner-driver CPA;
- coverage limit/CSI is not CPA premium;
- if legacy `cpa_premium` preserves other liability additions for compatibility, do not use that bucket to infer `cpa_opted`.

## 11. SAOD and liability-only rules

For current Liability Only / Third Party documents represented by the training set:

- IDV = 0;
- OD = 0;
- extract only the current liability policy financials.

For current SAOD documents:

- TP = 0 for the current contract;
- existing/active TP references remain external/reference-only;
- reconstruct total IDV from components where the schedule separates them.

## 12. Rounding-aware evaluator

Comparison should distinguish:

```text
MATCH / EXACT
ROUNDING_EQUIVALENT
OCR_MISSING
TABLE_ASSOCIATION_ERROR
SEMANTIC_ERROR
REFERENCE_CONFLICT
INSUFFICIENT_EVIDENCE
```

Do not count a PDF-printed whole-rupee value versus an equivalent decimal calculation as the same severity as extracting the wrong table token.

## 13. Fresh-sibling regression requirement

A parser is not trained merely because the exact policy used to design the rule passes.

For every supported layout, maintain at least:

1. one sanitized trained/failure-shape fixture;
2. one fresh sibling fixture with changed identifiers, dates, vehicle values and financial values;
3. where possible, a small variation in row ordering/spacing.

Prefer multiple representative real documents before describing support as broad.

## 14. CI and branch plan

Use a dedicated branch such as:

```text
ocr-training/<insurer-or-corpus>-<layout-or-failure>
```

The canonical gate is `.github/workflows/verify-web-portal.yml`.

Inspect current commands before changing them. The full gate should cover all existing OCR regressions, latest production-rerun/fresh-sibling tests, onboarding OCR import tests, training workflow tests, TypeScript typecheck, lint and production build.

Do not weaken an already-correct insurer path to fix a new sample. Do not call the work ready because only the targeted regression passes.

## 15. Production training loop

1. Inspect current repository/handoff/skill.
2. Read latest training comparison rows read-only.
3. Match all rows to actual PDFs.
4. Establish PDF truth.
5. Classify mismatches.
6. Group by insurer + layout + root cause.
7. Fix reusable structural rules first.
8. Add privacy-safe trained + fresh-sibling regressions.
9. Get canonical CI green on the exact feature head.
10. Merge only with explicit user approval.
11. Deploy only with explicit user approval/current release workflow.
12. Rerun the same corpus plus fresh siblings.
13. Re-measure live results.

Do not keep adding more PDFs while one known architectural defect still affects many existing samples. Fix the shared structural problem first.

## 16. Recent implementation evidence

### PR #548

22-policy insurer/layout refinement merged as:

```text
1a8acf8f036f1b4f3671616f54c7e3600e1344b9
```

### PR #550

Structural refinement after the 22-policy rerun:

```text
Verified feature head: b965ce8fada746d071b88cf9ce9dd36ec5e8e711
Verify web portal: run #1645 / 32568214383 — success
Merge commit: e857ec41385671ee1901519bc2c4662f7de8fd55
```

Key v6 changes included current-insurer hard gating, Shriram routing, stronger insurer/layout table interpretation, split-GST handling, vehicle rejection/identifier guards, financial sanity checks and fresh-sibling regressions.

These are implementation/CI landmarks, not proof of universal live accuracy.

## 17. Done criteria for the next phase

The next refinement phase is complete only when:

- insurer + layout routing remains correct across trained and fresh samples;
- current-policy identity/periods are correct;
- make/model/fuel/RTO table association materially improves;
- engine/chassis/registration do not concatenate or absorb headings;
- financial components reconcile;
- owner-driver CPA semantics remain separate from other liability additions;
- reference conflicts are flagged rather than trained;
- rounding-equivalent cases are classified separately;
- privacy-safe trained + sibling regressions pass;
- the complete GitHub gate passes;
- live post-deployment reruns show real improvement toward the 90–95% target.

Safe withholding remains a correct outcome when evidence is insufficient.
