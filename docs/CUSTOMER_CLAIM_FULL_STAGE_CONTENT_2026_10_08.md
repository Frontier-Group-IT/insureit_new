# Customer Claims — Operations stage content parity continuation

## Scope
Customer namespace only; no Operations/Partner modification. Branch `fix/customer-claims-full-operations-stage-content-2026-10-08`.

## Implemented on branch
- Replaced the generic claim document-type selector and upload field with seven Operations-style categorized document cards for Accident Photo, RC Copy, Insurance Copy, Driver Licence, GR/Load Bill, Accident Video and Audio.
- Group cards show counts by verified/pending document statuses and allow category-specific customer uploads through existing customer-scoped upload action.
- Stage 1 displays accident date/time, spot intimation time, driver name/number and location in the compact Operations-style five-column grid.
- Later stages show milestone details in compact field columns with preserved customer-only write forms where previously permitted.
- Existing nine-stage strip remains.

## Important limitations
Operations verification/approve/reject actions must NOT be granted to customers. Verification status is displayed only. Original Operations page uses separate read/write/admin workflows and richer document metadata; this branch is not 100% functionally identical. New UI does not add customer authorization to Operations workflows.
- Stage 1 driver/spot fields may be blank if data is stored only in claim-stage details rather than milestones; requires live-account runtime review.
- Full file previews, per-document verification history and all exact per-stage field definitions require additional secure integration and browser comparison.

## Release
Do not merge until GitHub checks complete and runtime UI reviewed. No APK/AAB, migration or production deployment.
