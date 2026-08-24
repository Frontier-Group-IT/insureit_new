# Policy OCR Training Handoff — 22-Policy Multi-Insurer Phase

> Consolidated: 2026-08-22 (IST)
>
> This handoff captures the durable state and lessons from the 22-policy insurer/layout training phase. It supplements `docs/POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md` and the repository skill `docs/INSUREIT_POLICY_OCR_AUTOMATED_TRAINING_SKILL.md`.
>
> Never store raw policy copies, full OCR dumps, policyholder/customer PII, real policy numbers, registration/chassis/engine values, credentials, tokens, or provider secrets here.

## 1. Current training objective

The user is iteratively improving INSUREIT Policy OCR toward approximately **90–95% correct fields** on representative live motor-policy documents.

### USER-REPORTED current result

After the latest v5/v6 refinement and another live rerun of the trained corpus, the user reported approximately **70–75% successful extraction**.

This is meaningful improvement but is not a formal benchmark. A later quantitative score must define the denominator and separate PDF/reference conflicts, rounding-equivalent values, safely withheld fields, and genuine parser failures.

## 2. Final ground-truth rule

**APPROVED / DURABLE:** the actual policy PDF is final truth whenever the verified/database reference conflicts with the document.

Training workflow must:

1. independently read the actual policy document;
2. compare Database Reference vs Google/INSUREIT result vs PDF truth;
3. mark a conflicting DB value as a reference conflict;
4. never encode the wrong reference into parser behavior merely because the row was marked verified.

Withhold uncertain values instead of guessing.

## 3. Architecture now expected

The intended parser architecture is:

```text
current-policy insurer header
 -> insurer family
 -> product / document layout family
 -> dedicated layout parser/refiner
 -> semantic + financial sanity checks
 -> review proposal
```

Do **not** treat one parser as universal for an insurer. The same insurer can have different layouts for Package, SAOD, Third Party/Liability Only, GCV/PCV/PCP/TWP, bundled/long-term, bilingual, and other product families.

### Current-insurer hard gate

Previous-policy insurer, active/existing TP insurer, broker text, footer references and renewal/history text must not determine the current-policy parser.

A documented production failure routed a Shriram current policy through HDFC-style logic because unrelated insurer references were present. PR #550 added current-header hard gating. Preserve this principle for every future family.

## 4. Observed layout families in the latest corpus

The 22-policy phase covered or refined families including:

- United India — GCV Package;
- United India — PCV Package;
- United India — motorized 3W Liability Only;
- National — GCV Package/bilingual schedule;
- National — Private Car Liability Only;
- National — Long-Term Two-Wheeler Bundled;
- HDFC ERGO — Private Car Package/Comprehensive;
- HDFC ERGO — Two-Wheeler SAOD;
- HDFC ERGO — Two-Wheeler Liability Only;
- Magma — Private Car Package;
- Magma — Private Car SAOD;
- Magma — Commercial Vehicle Liability Only;
- Digit — Private Car Package;
- New India — Private Car SAOD;
- Royal Sundaram — Liability Only;
- Shriram — current-policy liability/third-party layout represented in the corpus.

This is **observed layout support only**. Do not claim universal insurer support from one layout.

## 5. What improved in the last round

### IMPLEMENTED — PR #548

PR #548 trained/refined the parser across the 22-policy insurer/layout corpus and was merged as:

```text
1a8acf8f036f1b4f3671616f54c7e3600e1344b9
```

The important architectural move was insurer-wise, then layout-wise parsing rather than one generic parser.

### IMPLEMENTED / VERIFIED IN CI — PR #550

PR #550 `Refine OCR structural parsing after 22-policy rerun` was verified on exact feature head:

```text
b965ce8fada746d071b88cf9ce9dd36ec5e8e711
```

Canonical verification:

```text
Verify web portal run #1645
Run ID: 32568214383
Conclusion: success
```

Merged into `main` as:

```text
e857ec41385671ee1901519bc2c4662f7de8fd55
```

The v6 changes included:

- hard current-insurer header gating;
- dedicated Shriram current-policy routing;
- stronger insurer/layout-specific premium extraction;
- UIIC 3W/PCV/GCV handling;
- National GCV/PCP-TP/TWP separation;
- HDFC split-GST handling;
- Digit PCP structural financial parsing;
- New India/Royal/Magma refinements;
- vehicle heading/value rejection and identifier guards;
- financial sanity checks;
- fresh-sibling regressions.

The successful CI run proves the automated gate for the exact feature head. It does not prove universal live accuracy.

## 6. Main remaining failure class

The dominant remaining problem is **structural table association**, not basic character recognition.

Repeated failure patterns included:

- make/model values replaced by nearby headings;
- fuel/RTO values pulled from the wrong cell or surrounding text;
- engine/chassis concatenation;
- percentages and IMT/SAC codes promoted into premium fields;
- policy totals pulled from the wrong premium-table row;
- a trained document performing better than a fresh sibling with the same nominal layout.

### Correct engineering response

Use insurer/layout-specific row/column schemas and bounded table/text extraction. Do not keep widening shared global regexes.

## 7. Fresh-policy consistency lesson

**LEARNING:** passing the exact training copy is not enough.

The user observed that the same policy used for training often returned better results than a fresh policy from the same insurer/layout.

Every supported layout should therefore maintain at least:

- one sanitized regression for the originally failing/trained shape; and
- one fresh sibling regression with changed identifiers, dates, vehicle values and financial values.

Where practical, vary spacing/row ordering enough to prove the parser learned the structural rule rather than exact token adjacency.

Do not call a layout robust until fresh sibling behavior is also acceptable.

## 8. Financial lessons

Treat premium interpretation as accounting.

### Required semantic components

Keep separate concepts for:

- OD premium;
- Basic TP;
- owner-driver CPA/PA;
- non-owner liability additions such as paid driver/workmen/passenger liability;
- printed net premium;
- tax/GST;
- gross/total payable.

### Sanity rules

Reject/withhold when:

- a liability addition becomes negative;
- TP is implausibly larger than net/gross without explicit printed evidence;
- the extracted components do not reconcile with the printed net;
- net + tax does not reconcile with gross beyond reasonable printed rounding;
- a percentage/code/token is being treated as an amount.

Known dangerous contexts: GST rates 5/9/18, NCB percentages, IMT 25/28/other codes, SAC/reference numbers, table indices, coverage-limit values and unrelated identifiers.

### Split tax

Where the schedule splits taxes, sum the actual tax amounts:

- CGST + SGST/UTGST;
- split IGST components where applicable.

Never use the percentage itself as the tax amount.

## 9. CPA lessons

Owner-driver CPA semantics must be kept separate from other liability additions.

Rules:

- explicit positive owner-driver PA/CPA premium => `cpa_opted = Yes`;
- explicit zero/No/removed/not opted/not provided => `cpa_opted = No`;
- paid-driver/workmen/passenger liability additions do not imply owner-driver CPA;
- owner-driver CSI/coverage limit is not the premium;
- if legacy `cpa_premium` preserves other liability additions for compatibility, that accounting bucket must never automatically flip `cpa_opted` to Yes.

The real-policy comparisons corrected multiple cases where verified reference rows had previously taught the wrong CPA meaning.

## 10. SAOD and liability-only invariants

For current Liability Only / Third Party layouts:

- IDV = 0 under the currently represented product semantics;
- OD = 0;
- use current-policy liability rows only.

For current SAOD layouts:

- current TP = 0;
- an active/existing TP policy in the document is reference-only and must not be parsed as the current policy;
- total IDV may need to be reconstructed from component IDVs rather than taking only the vehicle component.

## 11. Vehicle extraction lessons

The hardest repeated fields were make/model/fuel/RTO and, in some layouts, exact engine/chassis association.

Required approach:

- use the layout's expected vehicle table columns;
- reject headings and section labels as values;
- validate engine/chassis/registration shapes;
- prevent concatenated identifiers;
- normalize make/model only after real evidence;
- derive class from proven layout when that is more reliable than OCR order;
- keep RTO extraction anchored to registration/RTO fields.

Do not solve these failures by adding exact real vehicle values to source code.

## 12. Rounding and comparison classification

Do not treat a whole-rupee printed premium and a mathematically equivalent decimal as the same severity as a wrong field.

The comparison layer should distinguish at least:

```text
EXACT / MATCH
ROUNDING_EQUIVALENT
OCR_MISSING
TABLE_ASSOCIATION_ERROR
SEMANTIC_ERROR
REFERENCE_CONFLICT
INSUFFICIENT_EVIDENCE
```

Actual policy printing remains final truth.

## 13. Privacy and database rules

During OCR training/refinement:

- operational policy/customer/vehicle records are read-only unless the user explicitly authorizes a specific operational write;
- training/reference data should be queried read-only by default;
- no raw PDF or OCR dump in source control;
- no real customer/policyholder identity in fixtures;
- no real registration/chassis/engine/policy identifiers in fixtures;
- use deterministic synthetic values preserving only the format needed for regression.

## 14. Recommended next workflow

Continue from the latest 22-policy baseline with this cycle:

1. Pull the latest approved rerun comparison rows read-only.
2. Match every row to the real PDF.
3. Recompute PDF truth independently.
4. Separate reference conflicts and rounding-equivalent differences from parser failures.
5. Aggregate failures by insurer + layout + structural cause.
6. Fix the highest-reuse cause first, not one policy at a time.
7. Add/update trained + fresh-sibling sanitized regressions.
8. Run the complete canonical GitHub verification gate on the exact feature head.
9. Merge only after user approval.
10. Deploy only after explicit approval/current release procedure.
11. Rerun the same corpus plus fresh sibling policies.
12. Quantify live improvement before claiming the 90–95% target.

### Priority of future refinement

Based on the latest rerun, focus effort on:

- table-column make/model/fuel/RTO extraction;
- insurer-specific policy-period selection where multiple periods exist;
- remaining premium-row association edge cases;
- fresh-sibling consistency rather than exact-copy optimization.

Do not add large numbers of new samples while a known structural failure still affects multiple existing layouts. Fix the reusable rule first.

## 15. Definition of success for the next phase

The next phase is successful when:

- current insurer/layout routing remains stable;
- previously trained copies do not regress;
- fresh siblings from the same layout approach comparable accuracy;
- unsafe table tokens are withheld rather than guessed;
- financial values reconcile;
- PDF/reference conflicts are classified rather than encoded;
- privacy-safe regressions cover each known failure shape;
- live post-deployment measurement moves materially toward the user's 90–95% target.

Do not sacrifice safe withholding to inflate the apparent match rate.

## 16. Round 8 fresh-20 production handoff

**DEPLOYED / VERIFIED 2026-08-24:** Round 8 parser refinement from the sealed
fresh-20 benchmark is live in production.

Release evidence:

- feature commit: `ca851513b4bd7f03300a6e55c1b72b28f5d85347`;
- canonical `Verify web portal` pull-request run: `32761770469` (`success`),
  including all OCR regressions, typecheck, lint and the production build;
- PR `#608` merged to `main` as
  `320949898c7080591842b06ad8528c1174659767`;
- GitHub production deployment `6068839674` targets that exact merge commit and
  reports `success` / `Deployment has completed`;
- the authenticated production route
  `https://portal.insureit.in/system/policy-ocr-training/holdout` was opened after
  deployment and rendered all 20 verified holdouts without a capture failure.

Final sealed-set result shown in production:

- precision: `80.4%` (`267/332` proposed fields correct);
- coverage: `68.7%` (`332/483` expected fields proposed);
- withheld/missing: `151`;
- semantic errors: `65`;
- perfect policies: `0/20`;
- predictions frozen: `20/20`;
- truth verified: `20/20`;
- capture failures: `0`.

The live page still says **"Round #3 parser logic is frozen."** This is stale UI
copy on the holdout page, not evidence that production is running the Round 3
parser. The exact deployed commit above contains the Round 8 refinement. A future
UI-only cleanup may update the wording, but must not rewrite the recorded sealed
benchmark result.

These 20 documents are no longer blind holdouts because their truth has been
revealed. Treat them as a privacy-safe regression/training corpus from this point
forward. Any further generalization claim must use a new sealed sibling set with
predictions frozen before PDF truth is inspected. The next refinement should
aggregate the remaining `151` missing fields and `65` semantic errors by insurer,
layout and structural cause; fix reusable parser rules; retain safe withholding;
and rerun the full canonical PR gate before another explicitly approved merge and
deployment.

## 17. Round 9 Digit MISD cash-van recovery

**IMPLEMENTED / LOCALLY VERIFIED / NOT MERGED OR DEPLOYED 2026-08-25:** the
first Round 9 increment targets the three Go Digit Package/MISD cash-van
siblings in the revealed fresh-20 corpus.

Read-only classification from the latest production benchmark showed the same
large gap on all three siblings: CPA opted/premium, OD, TP, net, GST, gross,
make, model, fuel, manufacturing year, GVW and chassis were withheld on every
copy; one engine field was also withheld; and all three RTO states contained
registration prefixes instead of state names. Across those three policies this
is `40` missing fields plus `3` semantic errors.

The protected PDFs were opened through the authorized production portal and
inspected only from a temporary local directory. No PDF, raw extracted text or
real policy/registration/engine/chassis/customer identifier is in the branch or
fixtures. The repeated printed structure is:

- `Make ... Trailer Reg. No. ... RTO Location city,state`;
- `Model/Vehicle Variant ... Year of Regn. / Manufacturing` plus an optional
  `(Sub-Type)` continuation;
- one bounded `Engine No. ... Chassis No. ... Cubic Capacity` row;
- one `Fuel Type ... Gross Vehicle Weight ... Vehicle Body Type Cash Van` row;
- an explicit owner-driver PA opt-out;
- page-two `Total OD`, `Total Act`, `Net Premium [A+B]`, GST and `Total Premium`
  rows.

`policy-ocr-production-round9-fresh20-recovery.ts` recovers only this strongly
gated Digit cash-van layout. It accepts the financial block only when
`OD + TP + CPA = net` and `net + GST = gross` within two paise. Mismatched
totals remain withheld. Three privacy-safe synthetic siblings and a deliberate
financial-mismatch case are covered by
`policy-ocr-production-round9-fresh20-regression.ts`; the canonical workflow
also includes that regression.

Local checks passed for the Round 9 regression, Round 8 regression, Round 3
precision guard, the existing Digit regression and all approved-layout
regressions. A protected local replay of the new refiner against text extracted
from all three real PDFs recovered every checked approved value for the new
layout; engine/chassis were asserted only for presence and were not printed in
logs. This is parser evidence, not a live Google replay.

If the deployed Google page text preserves the same printed labels, the maximum
expected corpus delta is `+40` proposed fields and `+43` correct fields (the 40
withheld values plus three corrected RTO states). That would project the
revealed-corpus aggregate from `267/332` to `310/372`, or approximately `83.3%`
precision and `77.0%` coverage. Treat this strictly as **UNVERIFIED** until a
separate post-deployment replay measures it. Never overwrite the immutable
Round 8 frozen prediction/result to obtain the replay score.
