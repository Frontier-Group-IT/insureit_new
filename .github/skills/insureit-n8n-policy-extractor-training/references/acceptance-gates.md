# Acceptance gates: every insurer training PR

## Evidence (required)
- [ ] PDF type and insurer detected unambiguously from document body, not caller-supplied label.
- [ ] Actual original PDF privately checked; page/label evidence for every field. No PDF/PII committed.
- [ ] PDF → n8n → adapter → queue → saved draft → form → Convert results compared field by field.
- [ ] Current PDF document/fingerprint and parser published version matched to the observed error.
- [ ] No original policy, customer, VIN, engine, mobile, token or signed URL in regression fixtures.

## Parsing and mapping
- [ ] Source provenance stored as PDF-printed, registry-confirmed, or manufacturer-derived; uncertain fields review-held.
- [ ] RTO state **and city** populated from named authority when present; no false full plates or insured-address authority.
- [ ] Unregistered versus registered status and vehicle lookup work for correct product variant.
- [ ] Make/model/fuel matches actual dropdown choices; no guessed Diesel for electric/unknown models.
- [ ] Capacity correctly typed: GVW versus CC versus kW; no fallback from seat count/model digits.
- [ ] Printed issuance date and validity distinguished and insurer-specific approval honored.
- [ ] OD/TP/CPA/LL/add-ons, tax by schedule (5% and 18% possible), net and gross reconcile.
- [ ] Each true missing/conflicting field has a **specific, current** exception reason; stale reasons not shown as current.
- [ ] Green Convert/Verify & Convert invokes server preflight, not just a parser check count; no manual form prerequisite for a truly bookable policy.

## Regression and release
- [ ] Reported real case passes private field-by-field test.
- [ ] At least two different real layouts when available, plus synthetic successful and failure fixtures.
- [ ] Negative test incomplete RTO, wrong issuing-office/address city, unknown manufacturer, electric/fuel conflict, CPA double count, mixed GST, date conflicts, duplicate policy, stale PDF, already booked, and repeated Convert.
- [ ] Existing insurer regression suites not broken.
- [ ] `verify-web-portal.yml` passes regressions, TypeScript, lint, build.
- [ ] If n8n node changed: isolated draft tested; active/published version and website schema compatible before publish.
- [ ] PR merged only after gates and requested authorization; no automatic production deployment.
- [ ] Live deployed commit, intake UI and final booking state separately verified. Never report synthetic tests as live success.
