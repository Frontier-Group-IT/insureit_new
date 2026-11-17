# ICICI 3005 n8n handoff: Chetak 3503 model-name variant

## Issue and exact cause
A newly supplied ICICI Lombard Product 3005 bundled two-wheeler PDF prints `Vehicle Make / Model: CHETAK / CHETAK 3503`. The earlier C2501/C3503 implementation only recognized exact `C3503`-style model codes in both the n8n proposal enrichment and the canonical OEM/kW mapping. As a result the form received the model text but did not propose vehicle class, fuel type, Bajaj master or Bundled product (the product selector is class-dependent).

The separate page-2 current vehicle schedule includes **4.2 kW** under `CC/KW`, **2026** manufacturing year and **2** seats. **2 seats is not 2 kW.** The user-supplied PDF remains private; no identifying details are included in repository fixtures.

## Implemented
- Normalize only exact known Chetak Product 3005 model aliases for **matching**: `C2501/C3001/C3501/C3502/C3503` and `CHETAK 2501/3001/3501/3502/3503`. Retain the actual printed `CHETAK 3503` model text in the editable onboarding form.
- For verified bundled Chetak two-wheelers, propose `TWP`, `Electric`; let the existing canonical mapper resolve **Bajaj**, then allow the dependent **Bundled** policy product.
- Require explicit Electric evidence for the C3503 OEM alias. Do not guess power; allow `Capacity (kW)` only from the separately validated `vehicle_motor_power_kw` value.
- Update the **draft** n8n ICICI Product 3005 parser to accept the exact two-word model variant and extract the printed power cell from the same model/year vehicle row. The production **published** n8n version remains unchanged.
- Preserve original permission checks, fingerprint/current-PDF re-extraction, duplicate policy guards, manually corrected data and optimistic revision protection for existing drafts. No automatic booking or customer linking.
- Add new synthetic web regressions for both model spellings, positive 4.2 kW, RTO and master selects, absence of kW in the older published response, and negative unknown-model behavior.

## Validation and deployment
- n8n test execution **26**: existing C2501 synthetic parser + 2.2 kW -> pass.
- n8n test execution **27**: synthetic CHETAK 3503 + 4.2 kW and the same validated proposal constraints -> pass.
- Temporary synthetic assertions removed, original C2501 test fixture restored, and Manual Synthetic Test trigger disabled again. No live customer/policy data was touched by tests.
- Before merge: `Verify web portal` CI must pass the full regression suite, typecheck, lint, build; resolve any review findings. Merge only when explicitly requested. Deploy website and publish n8n **only when separately approved**; production capacity will remain blank without publishing the updated n8n parser.
- After both releases, open the affected Intake, rerun n8n on its current PDF and explicitly select **Fill missing fields in a saved draft**. Check Class=TWP, Make=Bajaj master, Model=CHETAK 3503, Fuel=Electric, Capacity=4.2 kW, Product=Bundled and matching RTO/financial fields against the original PDF. Do not book during smoke testing.

## Rollback
Revert this PR if web mapping regresses. Restore the prior published n8n workflow version if an approved publication regresses. No database schema change.
