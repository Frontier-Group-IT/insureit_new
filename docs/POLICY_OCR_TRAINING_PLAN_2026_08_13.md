# Policy OCR Training Plan - Multi-Insurer Policy Copies

> Created: 2026-08-13
>
> Scope: improve Policy Onboarding OCR accuracy for non-IFFCO policy copies while preserving the existing Google Document AI architecture, review-before-apply workflow, and Section 03-only import boundary.
>
> Do not store raw OCR text, complete policy copies, policyholder PII, vehicle identifiers, full policy numbers, PAN, phone, address, credentials, tokens, or decrypted provider data in this file or in regression fixtures.

## 1. Objective

Make policy-copy reading reliable across the supplied insurer formats by building insurer-specific parser training fixtures and regression tests.

The correct interpretation of "training" for the current architecture is:

- keep Google Document AI as the OCR/layout extraction layer;
- train INSUREIT by adding sanitized insurer-specific text/table fixtures, expected outputs, parser/refiner logic, confidence rules, and regression gates;
- use layout/table evidence for premium financials whenever flattened text is ambiguous;
- withhold uncertain financial fields instead of guessing;
- continue to show all OCR results in the review modal before apply.

## 2. Current Baseline

Already supported:

- IFFCO-Tokio commercial motor, including a structured premium-table refiner.
- Go Digit commercial motor.
- The New India Assurance commercial motor.

Current primary files:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/lib/policy-ocr-iffco-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts`
- `apps/web-portal/lib/policy-ocr-digit-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-new-india-refiner.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`

Existing regression commands:

- `npm run policy-ocr:iffco-structured-regression`
- `npm run policy-ocr:iffco-regression`
- `npm run policy-ocr:digit-regression`
- `npm run policy-ocr:new-india-regression`

## 3. Supplied Sample Set

The supplied PDFs were inspected only for insurer/layout classification and Section 03 signal coverage. Raw text and private values must not be committed.

| Local sample file | Detected insurer/layout family | Initial status |
| --- | --- | --- |
| `PolicySchedule_25794385_ 20250831_231011.pdf` | Shriram General motor package schedule | New parser family required |
| `M_S LOGISTICS CORPORATION OF INDIA-311101_31_2026_912.pdf` | The Oriental Insurance Company motor package schedule | New parser family required |
| `GCV-361802312619002997.pdf` | National Insurance bilingual GCV package schedule | New parser family required; encrypted/bilingual PDF handling required |
| `2025082330598845_Policy_92473372.pdf` | Universal Sompo motor bundled/private-car style schedule | New parser family required; confirm Section 03 product mapping |
| `MANISH AWASTHI.pdf` | United India PCV package schedule | New parser family required; United India was previously deferred |
| `361802312619002051.pdf` | National Insurance bilingual GCV package schedule | Same National family as above; add as second fixture |

The two National Insurance PDFs are encrypted but readable with the correct PDF backend. Regression fixtures should be sanitized derived text/table snapshots, not the PDFs themselves.

## 4. Approved Field Boundary

OCR may propose only these Policy Onboarding Section 03 fields:

- Insurance company
- Policy product
- Policy number
- Valid from
- Valid upto
- IDV / sum insured
- OD premium
- Third-party premium
- CPA opted
- CPA amount

Comparison-only fields:

- Printed net premium
- GST/tax amount
- Gross premium

OCR must not populate customer, insured, owner, address, phone, PAN, GSTIN, or other personal identity fields from the policy copy. Approved visible Section 02 vehicle fields may be proposed for explicit review and form application. Registration, chassis and engine values must be synthetic in reusable candidates and fixtures.

## 5. Training Data Rules

For each insurer sample:

1. Run Google Document AI Enterprise OCR and, where premium tables are ambiguous, the Layout Parser processor.
2. Save only sanitized fixture text/table rows under a regression-safe location, for example `apps/web-portal/scripts/fixtures/policy-ocr/`.
3. Redact or replace private values:
   - policy numbers may be replaced with deterministic synthetic values that preserve format;
   - personal/company names, phone, email, address, PAN/GSTIN, vehicle number, chassis, and engine must be removed;
   - premium, IDV, date, product, and insurer labels may remain only where needed for parser tests.
4. For each fixture, create a ground-truth JSON object containing only approved Section 02 vehicle fields and Section 03 fields/comparison totals. Replace policy, registration, chassis and engine identifiers with deterministic synthetic values.
5. Add a short evidence note explaining which labeled row/table proves each financial value.

## 6. Parser Family Plan

### Phase A - Sample Catalog And Ground Truth

Deliverables:

- Sanitized OCR text snapshots for all six samples.
- Sanitized layout-table snapshots for premium tables where available.
- Expected field maps for each sample.
- A fixture README listing insurer family, product type, sample count, and known parser risks.

Acceptance:

- No raw policy PDF or private identity value committed.
- Every expected value has a human-readable evidence label.

### Phase B - Detection Improvements

Add insurer-family detection for:

- `shriram_general_motor_v1`
- `oriental_motor_v1`
- `national_motor_gcv_v1`
- `universal_sompo_motor_v1`
- `united_india_motor_v1`

Detection must prefer header/page-1 insurer evidence and schedule structure. It must not classify from previous-insurer text alone.

Acceptance:

- All six samples route to the intended parser family.
- Existing IFFCO, Digit, and New India regressions still route correctly.

### Phase C - Non-Financial Field Extractors

For each family, implement high-confidence extraction for:

- insurer name;
- policy product;
- policy number, excluding previous policy number;
- policy dates, preferring current OD/liability period rules;
- IDV or total sum insured.

Acceptance:

- 100 percent match on these fields for the supplied samples.
- Dates normalize to ISO `YYYY-MM-DD`.
- Product maps to existing UI options: Package, Third Party, SAOD, Bundled, Long Term Package, or Long Term Third Party.

### Phase D - Financial Refiner Per Insurer

Implement premium interpretation separately for each family.

Required rule:

```text
OD premium + TP premium + CPA premium must reconcile to printed net premium when all four values are present.
```

If a company's printed liability total already includes CPA, normalize the stored `tp_premium` to exclude CPA so Section 03 remains consistent.

If the equation cannot be proven:

- return policy/company/dates/IDV where safe;
- withhold OD/TP/CPA;
- add a warning that financial fields require manual review.

Acceptance:

- No known table metadata, SAC code, GST number, policy number, engine number, or coverage limit is accepted as a premium.
- CPA coverage limit such as Rs. 15,00,000 is never treated as CPA premium.
- Printed net, tax, and gross are used only as comparison checks.

### Phase E - Regression Commands

Add one regression runner per new family:

- `policy-ocr:shriram-regression`
- `policy-ocr:oriental-regression`
- `policy-ocr:national-regression`
- `policy-ocr:universal-sompo-regression`
- `policy-ocr:united-india-regression`

Then add a combined local command:

```text
npm run policy-ocr:all-regressions
```

The existing GitHub `verify-web-portal.yml` gate should include the combined OCR command before typecheck, lint, and build.

### Phase F - UI Review Hardening

Keep the current modal review workflow, but make parser confidence easier to act on:

- show a warning when a parser is generic or partially supported;
- show field-level confidence and source page;
- preselect only high-confidence approved fields;
- leave uncertain financial fields unchecked or absent;
- require manual confirmation before apply.

### Phase G - Production Verification

Before deployment:

- run all OCR regression commands;
- run typecheck, lint, and production build;
- confirm GitHub Actions green for the exact commit.

After explicit deployment approval:

- upload one sample per new insurer from `https://portal.insureit.in`;
- verify review modal values before apply;
- verify no browser payload or server log contains prohibited private values;
- record only sanitized evidence and exact deployment commit.

## 7. Prioritized Implementation Order

1. National Insurance GCV, because there are two samples and the bilingual/encrypted format is high risk.
2. Oriental Insurance, because it has a commercial motor package layout and full Section 03 signals.
3. United India, because it was previously deferred and is now represented by a sample.
4. Shriram General, because it has full Section 03 signals but may need broker/previous-insurer disambiguation.
5. Universal Sompo, because the sample appears to be private-car bundled and may require business confirmation for how bundled cover maps into the current policy onboarding product fields.

## 8. Done Criteria

This training work is complete when:

- every supplied insurer sample has a sanitized fixture and expected output;
- every new insurer family has a dedicated parser/refiner;
- all existing and new OCR regressions pass in GitHub Actions;
- uncertain premium tables fail safely with review warnings;
- the production portal has been explicitly deployed and at least one live upload/review/apply journey per supported insurer has been verified from `https://portal.insureit.in`.

