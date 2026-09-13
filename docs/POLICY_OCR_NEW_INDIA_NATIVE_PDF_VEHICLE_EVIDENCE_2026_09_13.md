# New India Enhanced Covers — native PDF vehicle evidence training (2026-09-13)

## Evidence state

**IMPLEMENTED / NOT YET MERGED OR DEPLOYED**

This round follows the production diagnostic introduced in PR #1780. It replaces speculative OCR-shape training with a measured fallback for one verified failure mode.

## Production evidence that triggered this round

Live diagnostic trace `NI-02qbyo-7995` showed:

- parser: `new_india_motor_v1`
- Enhanced Covers routing: matched
- page 1 Vehicle Details block: present
- Google page text `Year of manufacture` label: absent
- Google page text `Chassis no./Engine no.` label: absent
- Google page-text VIN-shaped candidates: 0
- Google page-text engine-shaped candidates: 0
- Layout Parser tables: 10 total / 6 on page 1
- Layout Parser `Year of manufacture` label cell: absent
- Layout Parser `Chassis no./Engine no.` label cell: absent
- target fields before residual refiner: absent
- target fields after residual refiner: absent

Therefore the residual parser was not failing to interpret available Google evidence; Google did not provide the required labels/identifier evidence to the parser for this document.

The source PDF itself is digitally generated and contains an embedded text layer with the Vehicle Details table, including the explicit manufacturing-year field and the combined chassis/engine field. The actual identifiers are intentionally not recorded in this document.

## Implemented architecture

The normal OCR flow remains primary:

`PDF -> Google Enterprise Document OCR -> Google Layout Parser -> insurer/layout refiners`

Only when all of the following are true does the fallback run:

1. upload MIME type is `application/pdf`;
2. parser family is `new_india_motor_v1`;
3. this is the already-approved New India Enhanced Covers layout;
4. one or more of Manufacturing Year / Chassis / Engine are still missing after the Google pipeline.

The fallback then:

`original uploaded PDF bytes -> server-only native PDF text extraction -> positioned page rows -> explicit Vehicle Details labels -> bounded semantic recovery`

Implementation files:

- `apps/web-portal/lib/policy-ocr-native-pdf.ts`
- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- `apps/web-portal/scripts/policy-ocr-new-india-native-pdf-regression.ts`
- `apps/web-portal/package.json`

## Safety constraints

- Native PDF text is held only in memory for the current request.
- Raw native PDF text is not persisted and is never written to logs.
- Diagnostics expose only booleans/counts and whether the fallback was used.
- The fallback does not run for JPG/PNG/WebP uploads.
- A native PDF with no usable text behaves like the existing scanned-PDF path; no target field is guessed.
- Manufacturing Year is accepted only from the explicit `Year of manufacture` row.
- Chassis/Engine are accepted only from the explicit combined row.
- A unique 17-character VIN-shaped value is required for chassis.
- The other identifier must independently satisfy the bounded mixed-alphanumeric engine shape.
- Wrapped chassis text may be joined only from the next one or two visual rows in the same right-side column.
- Existing populated target values are not overwritten.
- The reader limits document pages, extracted pages, image size and execution time.

## Dependency

The serverless PDF text reader uses `unpdf` because it provides a serverless PDF.js build and native text extraction support without requiring external binaries. The dependency is used only in the fallback path via dynamic import.

## Regression

`policy-ocr-new-india-native-pdf-regression.ts` generates a synthetic digital PDF and verifies:

- positioned native text can recover the explicit manufacturing year;
- a line-wrapped 17-character chassis can be reassembled from the bounded visual column;
- the non-VIN identifier is preserved as engine;
- input without native text remains unchanged;
- ambiguous local identifier evidence is withheld.

The regression is chained into `policy-ocr:new-india-regression`, which is part of the canonical web-portal verification gate.

## Required next evidence

Before claiming this issue solved:

1. canonical PR verification must pass on the exact feature head;
2. user must explicitly approve merge/deploy;
3. Vercel must report READY for the exact merge commit;
4. the same real New India Enhanced Covers policy must be re-read in production;
5. runtime diagnostic `policy_ocr_new_india_native_pdf_fallback` must confirm native labels were found and which target fields were recovered;
6. the Policy Onboarding review modal must visibly show the recovered fields.

Do not mark the training cycle **LIVE VERIFIED** until step 6 is directly observed.
