# Policy OCR and Google Document AI Handoff

> **Consolidated:** 2026-08-09 (IST)
>
> Source of truth for Policy Onboarding OCR. Never store credentials, tokens, raw OCR text, complete policy documents, policyholder PII, vehicle identifiers, or secrets here.

## 1. Approved scope

Policy OCR may propose only Section 03 fields:

- Policy product
- IDV / sum insured
- OD premium
- Third-party premium
- CPA opted / amount
- Policy number
- Insurance company
- Valid from / upto

Printed net, GST/tax and gross premium are comparison-only. OCR must never populate customer/vehicle identity fields. Review-before-apply is mandatory.

## 2. Google / INSUREIT architecture

Google Document AI remains the reading layer. INSUREIT owns insurer detection, interpretation, accounting normalization, confidence and warnings.

Current server flow:

```text
Policy PDF/image
 -> Next.js server action
 -> Vercel OIDC / Google WIF
 -> Google Document AI Enterprise OCR
 -> page text + Document AI table cell anchors
 -> INSUREIT insurer detector
 -> insurer-specific text refiner
 -> structured financial refiner where available
 -> accounting reconciliation gate
 -> review modal
 -> selected Section 03 fields applied
```

Primary files:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/lib/policy-ocr-iffco-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts`
- `apps/web-portal/lib/policy-ocr-digit-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-new-india-refiner.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`

Production Google identity remains Vercel OIDC Workload Identity Federation with short-lived service-account impersonation. No service-account JSON key is used.

## 3. Verified parser baseline before structured-table change

User-local verification on 2026-08-09:

```text
IFFCO text/regression: 10/10 passed
Digit regression:       5/5 passed
New India regression:   5/5 passed
Typecheck:               passed
Lint:                    0 errors
Next.js build:           passed
```

These checks preceded the structured-table architecture change and must not be treated as verification of the new commits.

## 4. Production learning from IFFCO N8109328

**VERIFIED LEARNING:** flattened OCR text is not reliable enough to assign IFFCO premium-table columns by proximity alone. Live Google OCR correctly recovered insurer, Package product, policy number, IDV, dates and later CPA, but flattened premium interpretation produced unsafe values including OD `1`, TP `997134`/`22409`, where `997134` is table metadata/SAC rather than a premium.

Correct rule:

- Never accept a financial field only because a nearby number follows `Net(A)` / `Net(B)` in flattened reading order.
- Prefer structured table cells/rows when Google supplies them.
- Use labeled liability rows plus accounting reconciliation.
- If the financial set cannot be proven, withhold OD/TP/CPA instead of auto-applying guesses.

Known N8109328 accounting target:

```text
Basic TP = 7267
Legal Liability to Driver = 100
CPA = 330
TP = 7367
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

## 5. Structured IFFCO financial pass

**IMPLEMENTED IN REPOSITORY / NOT YET DEPLOYED OR LIVE-VERIFIED**

New file:

```text
apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts
```

Behavior:

1. Server action preserves Document AI `pages[].tables[]` cell text using each cell `layout.textAnchor`.
2. Existing IFFCO text refiner still owns insurer/product/policy/IDV/dates and comparison totals.
3. Structured pass rebuilds OD/TP/CPA from premium-table rows.
4. For current IFFCO family it uses:
   - `Basic TP Premium`
   - `Legal Liability to Driver`
   - `P.A. Owner Driver`
   - independently parsed printed net
5. Financial values are returned only when `OD + TP + CPA = printed net` within tolerance.
6. When structured evidence is incomplete or does not reconcile, unsafe financial fields are removed and Review Required is returned.

Relevant implementation commits:

```text
a63604a773f5c2cdd5eaba08ada83cb0f125daec  Add structured IFFCO table financial refiner
6e3b37af37b254de367707f5d99cad96816c997b  Wire Document AI table structure into policy OCR
f16058c0c159ec90f46d4b28a718d3205ab82a7b  Correct Google STS grant type after wiring
1b5a19e8a31e7a2c7acf62510e3dcb7de94fbbf2  Add structured IFFCO regression
22d62f0387368ff8d0f1725321e0a286b2b9f5df  Add structured regression command
```

Regression command:

```text
npm run policy-ocr:iffco-structured-regression
```

The synthetic regression covers:

- repairing the exact production-shaped bad state `OD=1 / TP=22409 / CPA=330` from structured rows to `15042 / 7367 / 330`;
- withholding all financial fields when structured CPA evidence is missing.

This regression has been committed but has not yet been run in the user's local environment after these commits.

## 6. Existing insurer scope

Supported pure-motor families remain:

- IFFCO-TOKIO commercial motor
- Go Digit commercial motor
- The New India Assurance commercial motor

United India remains deferred, including Miscellaneous/Special Type Vehicles and Contractors Plant & Machinery.

## 7. Release discipline / next steps

Ordinary commits do not intentionally deploy production. Do not modify `.deploy/production-trigger.json` unless the user explicitly says `deploy now` or `finish and deploy`.

Before deployment of the structured-table change, run:

```text
npm run policy-ocr:iffco-structured-regression
npm run policy-ocr:iffco-regression
npm run policy-ocr:digit-regression
npm run policy-ocr:new-india-regression
npm run typecheck
npm run lint
npm run build
```

After an explicit deployment request, verify the exact Vercel production commit and then upload the same real IFFCO policy again. The target financial result is OD `15042`, TP `7367`, CPA `330`. If Document AI does not supply usable table rows, do not reintroduce proximity guesses; inspect sanitized structural evidence and fail to Review Required instead.
