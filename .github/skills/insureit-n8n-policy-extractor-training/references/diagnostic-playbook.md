# INSUREIT n8n Extractor — Diagnostic Playbook

## First locate the precise fault, not the visible symptom

| Source/observation | Likely first failing boundary | Next check |
|---|---|---|
| PDF contains RTO city; n8n lacks `vehicle_rto_name` | Insurer Code node PDF layout/label | Native extracted text and bounded label parser |
| n8n has city; website `field_keys` lacks it | Contract validator or adapter filter | `policy-nontata-commercial-n8n.ts`; versions |
| Website queue has city; saved draft blank | Handoff / canonical field mapper | `handoff-actions.ts`, master RTO option, registration-state logic |
| Draft correct; field blank in browser | UI controlled state or master lookup | dropdown option IDs, loaded options, form state reset |
| "Make not matched"; Make visible as Tata | stale/sibling error, normalization mismatch or registration preflight | exact `exception_codes`, `last_error_code`, date and draft revision; do NOT assume popup is current |
| Green Convert; Make or fuel blank | false readiness from parser check count | product-specific form + evidence preflight |
| Reprocess works; Convert still fails | stale queue state, fingerprint or canonical duplicate/ownership/date gate | current document ID, exact fingerprint, separate blocking reason |

## Read-only Supabase investigation

Adapt exact schema to the live project; NEVER expose personal data in issue comments:

```sql
select i.id,i.intake_number,i.status,i.final_policy_id,
       q.state as queue_state,q.parser_id,q.checks_passed,
       q.exception_codes,q.last_error_code,q.field_keys,
       d.revision,
       d.draft_payload->>'make' as make,
       d.draft_payload->>'model' as model,
       d.draft_payload->>'fuelType' as fuel,
       d.draft_payload->>'rtoName' as rto_city,
       d.draft_payload->>'rtoState' as rto_state,
       d.draft_payload->>'registrationMode' as registration_mode
from public.policy_intake_requests i
left join public.policy_intake_ai_processing_queue q on q.intake_id=i.id
left join public.policy_intake_onboarding_drafts d on d.intake_id=i.id
where i.id = :intake_uuid;
```

Inspect *the matching n8n execution*, not an unrelated latest execution. Confirm active/published workflow version before editing. For an insurer Code node, preserve `contract_version`, `parser_id`, `parser_version`, `extraction_method`, `review_required`, `auto_finalize_allowed`, field `key/value/evidence/page`, exact named checks, commercial `premium_components`, validation warnings and identity IDs. Preserve n8n shared webhooks/auth. Use isolated draft and synthetic + real PDF tests; do not republish shared workflow without confirming website contracts.

## Source normalization

- A partial RTO prefix (e.g. `MP-51`) is not a registration plate. It can still separately identify the issuing authority when the **same PDF explicitly names it**. Preserve status as unregistered/partial; do not generate plate digits.
- Explicit `Name of registration authority` is stronger evidence than the policyholder residence, office location, financier address or GST issuing office.
- `TATA MOTOR/1918 AZURA` is a make/model pair; canonical make may be `Tata`, but that does not solve a missing RTO. Validate the actual dropdown ID and normalization.
- For commercial GCV, `GVW: 18500` is not `18500 cc`; a printed `0cc` must never become nonzero displacement.
- Mandatory priority: explicitly printed policy issue date FIRST (some PDF text outputs place the value before the label), signature-image date only as verified document-bound FALLBACK if printed missing; unverified receipt, creation timestamp, signature-presence flag and coverage inception are NEVER issuance fallback.\n- Inspect page rendering and a missing image-verification step before claiming the fallback is implemented. Preserve separate date approvals and OTP.\n- When SBI Package shows NCB or cross-page totals, first verify printed PRODUCT remains Private Car Package, then parse layout-specific premium subrows: basic OD minus NCB + add-ons = OD; TP basic + CPA; net + GST = gross. Do not train by intake ID.\n- See insurer-layout-incidents-2026-11.md for 0%/45% NCB, downstream HDFC TWP / SBI PCP mapping, and live/published version pitfalls.
- CPA/paid-driver liability, nil-depreciation endorsement, mixed GST rates, OD/TP subrows and insurer tax schedule must be reconciled by named row and exact bucket before booking.

## Minimum train/verify loop

1. Ground truth with page references and ambiguity flags.
2. Current parser execution and printed check map.
3. Current website adapter output and allowed fields.
4. Exact queue status and saved draft, including stale diagnostics.
5. Canonical UI selected option IDs and form readiness.
6. Small insurer/layout-family rule with provenance and negative tests.
7. Regression + TS + lint + build + GitHub CI.
8. Isolated n8n published-version verification only if node changed.
9. Fresh and previously held intake UI test. Live booking only when user explicitly confirms, never as part of training.

Reference the repository direct booking contract at `docs/AI_POLICY_PARSER_DIRECT_BOOKING_CONTRACT.md`.
