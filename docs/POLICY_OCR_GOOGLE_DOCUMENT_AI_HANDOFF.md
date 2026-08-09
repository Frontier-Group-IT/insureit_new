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
 -> Enterprise Document OCR processor
      -> flattened page text for insurer/product/policy/IDV/dates/comparison totals
 -> for supported IFFCO PDFs only: dedicated Layout Parser processor
      -> Document.documentLayout.tableBlock rows/cells
 -> insurer-specific semantic mapping
 -> accounting reconciliation gate
 -> review modal
 -> selected Section 03 fields applied
```

The Layout Parser is a separate processor. Do not assume Enterprise Document OCR returns the Layout Parser `documentLayout` tree.

Primary files:

- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/lib/policy-ocr-parsers.ts`
- `apps/web-portal/lib/policy-ocr-iffco-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-iffco-structured-refiner.ts`
- `apps/web-portal/lib/policy-ocr-digit-refiner-v2.ts`
- `apps/web-portal/lib/policy-ocr-new-india-refiner.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`

Production Google identity remains Vercel OIDC Workload Identity Federation with short-lived service-account impersonation. No service-account JSON key is used.

## 3. Production Google processors

Existing Document OCR processor:

```text
Name: insureit-policy-ocr
ID: 84d0facf88efc0d7
Type: Document OCR
Region: us
```

Dedicated Layout Parser created by the user on 2026-08-09:

```text
Name: insureit-policy-layout
ID: b630ad846c5137a1
Type: Layout Parser
Region: us
```

The application supports optional `GOOGLE_DOCUMENT_AI_LAYOUT_PROCESSOR_ID`; when absent it currently falls back to the verified project processor ID above. The processor ID is configuration metadata, not a credential. Do not store secrets or service-account keys in repository files.

## 4. Verified parser baseline before dedicated Layout Parser change

User-local verification on 2026-08-09 after the first structured-refiner implementation:

```text
IFFCO structured regression: 2/2 passed
IFFCO text regression:      11/11 passed
Digit regression:            5/5 passed
New India regression:        5/5 passed
Typecheck:                    passed
Lint:                        0 errors / warnings only
Next.js build:                passed
```

This proves the semantic/accounting refiner baseline, but it does not verify the new second-call Layout Parser integration. Run the same checks again after the dedicated Layout Parser wiring commit before another release.

## 5. Production learning from IFFCO N8109328

**VERIFIED LEARNING:** flattened OCR text is not reliable enough to assign IFFCO premium-table columns by proximity alone. Live Google OCR correctly recovered insurer, Package product, policy number, IDV, dates and later CPA, but flattened premium interpretation produced unsafe values including OD `1`, TP `997134`/`22409`, where `997134` is table metadata/SAC rather than a premium.

Correct rule:

- Never accept a financial field only because a nearby number follows `Net(A)` / `Net(B)` in flattened reading order.
- Use the dedicated Layout Parser's `Document.documentLayout.tableBlock` structure for premium-table rows.
- Use labeled liability rows plus accounting reconciliation.
- If the Layout Parser call fails, returns no usable table rows, or the financial set cannot be proven, withhold OD/TP/CPA instead of auto-applying flattened guesses.

Known N8109328 accounting target:

```text
Basic TP = 7267
Legal Liability to Driver = 100
CPA = 330
TP = 7367
Printed net = 22739
OD = 22739 - 7367 - 330 = 15042
```

## 6. Structured IFFCO financial pass

**IMPLEMENTED IN REPOSITORY / NEW DEDICATED LAYOUT PROCESSOR PATH NOT YET DEPLOYED OR LIVE-VERIFIED**

Behavior:

1. Enterprise OCR remains the first call and provides page text for the existing insurer-specific parser.
2. If the detected family is IFFCO and the upload is a PDF, the server makes a second authenticated call to the Layout Parser processor `b630ad846c5137a1`.
3. The request enables Layout Parser table annotation.
4. The server reads `document.documentLayout.blocks[].tableBlock`, preserving table rows and cell contents.
5. Existing IFFCO text refiner still owns insurer/product/policy/IDV/dates and printed comparison totals.
6. Structured pass rebuilds OD/TP/CPA from premium-table rows.
7. For the current IFFCO family it uses:
   - `Basic TP Premium`
   - `Legal Liability to Driver`
   - `P.A. Owner Driver`
   - independently parsed printed net
8. Financial values are returned only when `OD + TP + CPA = printed net` within tolerance.
9. If structured tables are unavailable/incomplete or do not reconcile, all IFFCO OD/TP/CPA fields are removed and Review Required is returned.

Relevant dedicated-Layout commits:

```text
ed48f4d46fef535a35d626850b97026c8251e373  Fail safe when IFFCO structured tables are unavailable
e49b3ac94adc5051a2a2ef9c39847b92b71e86c3  Use dedicated Layout Parser for IFFCO premium tables
```

Earlier structured-refiner commits remain part of the history:

```text
a63604a773f5c2cdd5eaba08ada83cb0f125daec  Add structured IFFCO table financial refiner
1b5a19e8a31e7a2c7acf62510e3dcb7de94fbbf2  Add structured IFFCO regression
22d62f0387368ff8d0f1725321e0a286b2b9f5df  Add structured regression command
```

Regression command:

```text
npm run policy-ocr:iffco-structured-regression
```

The synthetic regression covers:

- repairing the production-shaped bad state `OD=1 / TP=22409 / CPA=330` from structured rows to `15042 / 7367 / 330`;
- withholding all financial fields when structured CPA evidence is missing.

## 7. Existing insurer scope

Supported pure-motor families remain:

- IFFCO-TOKIO commercial motor
- Go Digit commercial motor
- The New India Assurance commercial motor

United India remains deferred, including Miscellaneous/Special Type Vehicles and Contractors Plant & Machinery.

## 8. Release discipline / next steps

Ordinary commits do not intentionally deploy production. Do not modify `.deploy/production-trigger.json` unless the user explicitly says `deploy now` or `finish and deploy` after the current code change.

Before deployment of the dedicated Layout Parser integration, run:

```text
npm run policy-ocr:iffco-structured-regression
npm run policy-ocr:iffco-regression
npm run policy-ocr:digit-regression
npm run policy-ocr:new-india-regression
npm run typecheck
npm run lint
npm run build
```

After explicit deployment approval, verify the exact Vercel production commit and upload the same real IFFCO policy again. Target financial result: OD `15042`, TP `7367`, CPA `330`. If Layout Parser does not supply usable rows, expected safe behavior is Review Required with OD/TP/CPA withheld, not guessed.
