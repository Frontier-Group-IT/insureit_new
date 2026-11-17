# n8n → canonical Policy Onboarding: custom dialog and ICICI 3005 Chetak prefill follow-up

## What the operator reported
The first live handoff worked, but the browser-native confirmation was inconsistent with the INSUREIT interface and the resulting editable draft had missing Insured Name, Class, Make, Fuel, RTO State/City, Capacity and Policy Product.

## Behavior on this PR
- The Development workbench uses an accessible branded **Continue to Policy Onboarding?** modal, a branded reviewer-takeover modal, and a saved-draft notice. The Continue flow no longer invokes browser-native `window.confirm` or `window.alert`. No bookings are initiated by this dialog.
- The existing manual `/policies/new?intake_id=...` form remains canonical; duplicated/invalid/unverified PDFs, changes to document SHA/fingerprint, permissions, reviewer ownership and existing bookings keep their guards.
- For **already saved drafts**, the operator can explicitly select **Fill missing fields in a saved draft** in the modal. Only eligible *empty* draft fields can be supplied and only at the expected revision. Existing manual fields and booking data are not overwritten; on conflict the user must reload. This allows correction of an Intake that previously created a sparse saved draft.
- **Insured Name:** Repository `AGENTS.md` deliberately prohibits applying policy-PDF-derived personal identity to the canonical onboarding form. The approved alternative is the already-linked `matched_customer_id`, and **only** when the current customer-master phone exactly matches the Intake phone. Without a linked master identity, the field remains blank for manual/approved customer selection; no OCR or partner phone-based guessing.
- **Class:** The strict ICICI Product 3005 / Bundled Chetak C2501, C3001, C3501, C3502 and C3503 layouts map to `TWP`. Unknown model families are not inferred.
- **Make:** Chetak maps to the exact enabled dropdown value `Bajaj` (falling back to `Bajaj Auto` if that is the actual master entry), not invented `CHETAK`.
- **Fuel:** Recognized exact current electric Chetak C-series model codes map to `Electric`; unrelated/unknown models remain for manual review.
- **RTO:** An exact recognized `STATE-CITY` combination, such as `MADHYA PRADESH-JABALPUR`, maps into `Madhya Pradesh` and `Jabalpur`. Unrecognized formats are never guessed.
- **Policy Product:** Once class is `TWP`, the verified `Bundled` value matches the current form's allowed options.
- **Capacity:** Never infer motor kW from battery kWh or manufacturer marketing. The n8n **draft parser** now proposes `vehicle_motor_power_kw` only if the current PDF's labeled `CC/KW` vehicle row has a positive bounded value associated with the exact make/model and manufacturing year. The canonical form can fill this only after class + Electric are set. If no unambiguous printed kW exists, leave blank.

## n8n deployment boundary
The connected n8n workflow `Iu6WUQiHeGwfDol9` is already **active/published** for production PDF reading. Its **draft only** has been extended with explicit Chetak class/fuel/CC-KW proposal fields and the optional return-field allowlist. This task **does not publish** that draft. Until the updated workflow is separately tested/published, the website will derive Class/Make/Fuel/RTO/Product from the existing validated fields, but **Capacity** will remain empty if the published n8n response does not include printed kW.

Do not publish the n8n draft, modify workflow credentials, change Supabase schema, merge this PR or deploy production without separate explicit user approval and complete tests. No customer PDF, signed URL, PII or live policy creation in CI.

## Verification
- Run Web Portal `Verify web portal` including Semi-auto Motor regression, typecheck, lint and production build.
- Synthetic positive: ICICI 3005 Chetak C2501, state-city, manufacturer master `Bajaj`, Electric, Bundled, printed power 2.2 kW. Negative: unknown model/state or no CC/KW source leaves fields manual.
- Handoff negative: stale n8n fingerprint/document, duplicate policy, invalid role, existing reviewer without takeover, saved draft revision conflict.
- Existing draft test: operator explicitly ticks fill blanks; manually entered non-empty fields remain identical after re-applying. Insured Name must come only from linked approved customer master, not the PDF.
- After user-authorized workflow publication and manual Vercel deployment, re-extract a consented current PDF and compare every mapped field, including the actual printed CC/KW figure, against the original document. Do not book a real policy during testing without separate authorization.

Rollback: restore previous published n8n version if tested parser regresses; revert this PR or restore previous Vercel deployment. No schema or stored private PDF changes are required.
