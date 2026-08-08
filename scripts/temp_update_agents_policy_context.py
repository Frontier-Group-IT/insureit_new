from pathlib import Path

path = Path('AGENTS.md')
text = path.read_text(encoding='utf-8')
marker = '## Policy Onboarding current operating context (2026-08-07)'
if marker in text:
    text = text.split(marker, 1)[0].rstrip() + '\n\n'

section = r'''## Policy Onboarding current operating context (2026-08-07)

Use this section as the compact, current operating contract for Policy Onboarding. It supplements the dedicated AuthBridge/OCR handoffs and the durable project context; it is not a transcript.

### Current verified implementation and production state

- **DEPLOYED:** production URL is `https://insureit-drab.vercel.app`.
- **DEPLOYED:** production trigger commit `4350d888fe2d2799f9f94465744b25c8cbd14bed` completed successfully in Vercel on 2026-08-07. It includes the compact Section 02 redesign, the create-mode header cleanup, the compact Section 01 source/ownership redesign, the Policy Intelligence sidebar work, the AuthBridge RC review workflow, Policy OCR header-modal workflow, and the transactional policy onboarding path available on `main` at trigger time.
- Do not assume later ordinary commits are live. Automatic Vercel deployment from ordinary commits is disabled; use the explicit production-trigger protocol above.
- The create-mode Policy Onboarding header intentionally does **not** show `Database enabled`, `AuthBridge UAT · prototype_v1 calculations`, or the explanatory sentence about creating/linking customer and vehicle records. Keep create mode visually clean unless the user explicitly changes this.

### Canonical current files

Before modifying this workflow, inspect the current `main` versions of:

- `apps/web-portal/app/policies/new/page.tsx`
- `apps/web-portal/components/policy-unified-form.tsx`
- `apps/web-portal/app/policies/policy-onboarding-actions.ts`
- `apps/web-portal/app/policies/authbridge-rc-actions.ts`
- `apps/web-portal/lib/authbridge-rc-api.ts`
- `apps/web-portal/components/policy-ocr-import-panel.tsx`
- `apps/web-portal/app/policies/policy-ocr-actions.ts`
- the current Supabase migration that defines `onboard_motor_policy(p_payload jsonb)` and the policy child tables

The visible current form uses the newer `onboardPolicy(...)`/`onboard_motor_policy(...)` path. Do not mistake the legacy basic `addPolicy`/simple `policies` insert path for the active create workflow merely because old functions still exist in the repository.

### Policy Onboarding data-source contract

The page currently combines four source categories:

1. **Supabase master data**
   - Insurance Company options come from `insurance_companies`.
   - Lead Source options come from active `intermediaries` records.
   - POSP and MISP must remain distinct intermediary types.
   - `SIBL / Partner` uses Partner-master records only.
   - The RM relationship is derived from the selected intermediary/account relationship, using the same Sales-department employee source/assignment used by POSP/MISP onboarding. Do not reintroduce a separate user-selected RM unless the user explicitly changes the rule.

2. **AuthBridge Detailed RC**
   - Explicit Fetch RC action only; never lookup on keystroke.
   - Provider response is reviewed in a modal before values are applied.
   - Full chassis and engine values may be displayed and saved after review; never log or commit them.
   - Existing insurance returned by RC is reference-only for the new policy and must not silently populate the new policy.
   - Applied RC data can populate customer/vehicle master fields and is referenced in `vehicle_rc_verifications`.

3. **Policy OCR**
   - The page has a single `Read Policy Copy` action in the Policy Onboarding header, not a full-width upload panel.
   - OCR opens a modal for file selection, processing, review, confidence/warnings, field selection and apply.
   - OCR only proposes the approved policy/premium Section 03 fields. It does not create/save records directly and must not populate customer/vehicle identity fields.

4. **Manual user entry plus derived calculations**
   - Browser calculations are previews only.
   - The database transaction is authoritative and recalculates financial values before saving.

### Section 01 — Policy source & ownership: current approved layout and behavior

The current compact Section 01 pattern is deliberate and should be reused conceptually when refining later sections.

Primary row has exactly four main controls:

1. Policy Issuance Date
2. Policy Type
3. Intermediary Type
4. Lead Source

Derived metadata appears directly below its parent control in a small secondary line with **no input box, no card, and no second-row visual container**:

- Under Policy Issuance Date: Month, auto-derived (for example `Aug 26`).
- Under Intermediary Type: assigned RM, derived from the selected Lead Source/account relationship.
- Under Lead Source: Intermediary Code, derived from the selected Lead Source.

The metadata line is important information, so it must remain readable: muted label, distinct small source indicator (`AUTO`, `ASSIGNED`, `MASTER` where relevant), and a stronger navy value. It should remain substantially shorter than a normal input row.

Lead Source behavior:

- Intermediary Type is chosen first.
- `POSP` → search active POSP records only.
- `MISP` → search active MISP records only.
- `SIBL / Partner` → search active Partner records only.
- Lead Source is editable/searchable autocomplete. Partial typing must show matching names; users must not need to type the full name.
- On exact/select match, derive and persist the assigned RM and code.
- POSP/MISP code = the respective POSP/MISP business code.
- SIBL/Partner code = the Partner ID/business-facing partner code, **not** the Supabase UUID.
- Intermediary Code is fully read-only.
- Changing Intermediary Type clears incompatible Lead Source, Intermediary Code and derived RM.
- The policy payload still carries `rmName`, `intermediaryType`, `leadSource`, and `intermediaryCode` even though RM/code are rendered as metadata rather than ordinary editable inputs.

### Section 02 — Insured & vehicle identification: current approved layout and behavior

The compact current layout uses three logical rows and preserves AuthBridge/manual edit behavior.

**Row 1 — Identity**

- Registration Number with compact attached `Fetch RC` action.
- Insured Name.
- Phone Number.
- Class of Vehicle.
- Small metadata under Registration shows RC state such as `Not checked`, `Checking registration`, `Verified & applied`, or linked-master state in edit mode.
- Small metadata under Class of Vehicle shows the derived vehicle classification. Do not render Vehicle Classification as a disabled input box.
- The old helper sentence `Provider response opens in a review popup. One lookup is made per click.` is intentionally removed from the normal layout.

**Row 2 — Basic vehicle details**

- Make.
- Model.
- Fuel Type.
- Year of Manufacturing.

These remain normal editable/confirmable fields in create mode even when AuthBridge pre-fills them. Auto-filled does not automatically mean read-only.

**Row 3 — Technical/registration**

- Capacity, with small derived Basis metadata (`CC`, seating/GVW/category-style basis depending on class).
- Chassis Number.
- Engine Number.
- RTO as one logical grouped control containing State and Name/Code side-by-side.

Edit mode continues to protect linked customer/vehicle master identity data from policy-level edits.

### UI refinement rule for remaining Policy Onboarding sections

The user is intentionally refining this page section-by-section to reduce vertical space and make it professional. Preserve this hierarchy unless explicitly changed:

- **User-editable or user-correctable values** → normal inputs/selects.
- **System/master/API-derived but important metadata** → compact text directly beneath or adjacent to the parent field; no disabled-input appearance.
- **Calculated financial outcomes** → grouped summary/band/row presentation, not disabled text boxes.
- Group related values together instead of creating extra cards/rows.
- Avoid duplicate display of ordinary form fields in the right sidebar.
- Compactness must not make important metadata unreadably small.

Current Section 03/04/05 presentation already began this direction:

- Net Premium, GST and Gross Premium are grouped in a premium calculation band rather than disabled-looking inputs.
- Projected OD/TP pay-in calculated amounts are outcomes beside their editable percentages.
- Total projected pay-in, TDS and Pay-in after TDS are grouped as calculated results.
- Gross Partner Payout is a calculated outcome rather than an editable-looking field.

Future refinement should continue from current `main`; do not reconstruct an older all-input-box layout.

### Policy Intelligence / right-sidebar contract

The right sidebar is meant to be a compact **Policy Intelligence / Booking control centre**, not a duplicate form summary.

Durable requirements from the current redesign:

- Do not repeat ordinary form fields merely to fill space.
- Prefer derived/operational information, completion signals, concise attention items and dense financial information.
- Use compact signals/icons/rows rather than one card per item.
- Financial figures should be row-based, not separate boxes for every number.
- Indicative margin belongs in the same financial ledger and should use status color (healthy/low/negative) rather than a separate descriptive Margin Health card.
- The separate `Verification & Resolution`, `Margin Health`, and `Booking Readiness` cards were intentionally removed during compaction; do not reintroduce them without user approval.
- Workflow progress is compact/horizontal.
- Attention items are condensed rather than card-per-error.
- The sidebar should not have its own avoidable vertical scrollbar in the standard desktop view.
- Sidebar positioning must respect both top and bottom boundaries: never overlap the app/Policy Onboarding header and never extend beneath the fixed bottom action buttons.
- Because positioning has been sensitive to viewport/header heights, inspect current positioning code and actual browser behavior before changing offsets. Do not return to a naive hard-coded section-relative `top` that causes drift or overlap.

### Policy create/save transaction and table mapping

Current create flow:

1. Build a structured payload containing `customer`, `vehicle`, `policy`, `premium`, `payin`, `billing`, `payout`, `authbridge`, and optional resolution decisions.
2. Server validates required policy/customer/vehicle identity fields.
3. Customer matching checks existing records; possible matches require explicit user choice. Never auto-link/merge by name alone.
4. Vehicle matching uses normalized registration (and the current conflict logic). If the vehicle belongs to a different customer, show an ownership conflict.
5. Ownership transfer is restricted to Manager/Admin-equivalent privileged roles and must be audited.
6. Final save uses the transactional Postgres RPC `onboard_motor_policy(p_payload jsonb)` so the booking either completes together or rolls back together.
7. Successful new policy is booked Active immediately under the current requirement.

Current target tables/records created or updated by the transaction include:

- `customers`
- `vehicles`
- `vehicle_ownership_history` when an authorized transfer occurs
- `policies`
- `policy_party_snapshots`
- `policy_premium_details`
- `policy_payin_details`
- `policy_payin_bills`
- `policy_intermediary_payouts`
- `vehicle_rc_verifications` when AuthBridge data was applied

Important persistence choices:

- Policy history uses an immutable customer/vehicle snapshot so later master changes do not rewrite historical policy facts.
- Policy number uniqueness is scoped by insurer + normalized policy number in the designed canonical model.
- Current policy financial rows retain `calculation_version = 'prototype_v1'` until the client approves replacement rules.
- RM is currently persisted as `rm_name` text in the policy payload/schema rather than as a guaranteed employee UUID relation; do not silently change this persistence contract without a reviewed schema migration.
- Lead Source/intermediary identity is currently persisted using display/business values including intermediary code; the intermediary UUID fetched for UI use is not automatically equivalent to the persisted business code.

### `prototype_v1` calculation contract

Until replaced by an explicitly approved client rule set, preserve the current server-authoritative prototype calculations:

- `Net = OD + TP + CPA`.
- Normal GST = `Net * 18%`.
- GCV GST = `(OD + CPA) * 18% + TP * 5%`.
- Gross = Net + GST.
- Projected OD pay-in = OD * OD pay-in %.
- Projected TP pay-in = TP * TP pay-in %.
- Total projected pay-in = projected OD + projected TP + insurer scheme.
- TDS = total projected pay-in * 10%.
- Pay-in after TDS = total projected pay-in - TDS.
- OD payout = OD * partner OD %.
- TP payout = TP * partner TP %, except TP payout is zero when payout basis is `OD`.
- Gross partner payout = OD payout + TP payout - retention (current UI clamps negative displayed gross payout to zero; inspect current DB behavior before changing financial semantics).

Do not treat browser-computed values as authoritative. Server/database calculation remains the source of truth.

### Durable numeric-save learning

**LEARNING:** A previous policy-save failure persisted after an initial sanitizer because optional blank financial values were being normalized to `""`, while the RPC contains casts of the form `coalesce((value)::numeric, 0)`. PostgreSQL attempts `''::numeric` before `coalesce`, so the transaction still failed.

Correct rule:

- Optional financial values that are cast directly to numeric by the RPC must be normalized server-side to numeric-safe strings such as `"0"`, not empty strings.
- Provider-formatted vehicle values such as `1497 CC`, `4 Seats`, `2,850 KG`, `NA`, or `Not Available` must be normalized before numeric/integer database casts.
- Vehicle fields whose SQL path explicitly uses `NULLIF(value, '')` may safely use blank/null-compatible handling; do not assume the same is true for financial fields.
- When this error recurs, inspect the exact RPC cast expressions and payload after server normalization rather than adding another browser-only sanitizer.

### Customer/vehicle resolution rules

Preserve the user-approved safety behavior:

- Customer phone is mandatory for policy onboarding.
- Possible customer matches are shown to the user and require explicit selection; never auto-link by name alone.
- Existing vehicle linked to a different customer triggers a conflict workflow.
- Normal users must not silently transfer ownership.
- Manager/Admin-equivalent privileged roles may confirm ownership transfer; record the change in `vehicle_ownership_history`.
- AuthBridge owner address is reviewable and applies only after user confirmation.
- Existing insurance in RC remains reference-only for the new policy.

### AuthBridge review-modal requirements specific to Policy Onboarding

- Use a professional modal/portal above the entire app; do not expand the RC response inline inside the form.
- Desktop: large centered modal. Mobile: full-height sheet/fullscreen behavior as appropriate.
- Fixed header/footer and scrollable modal body.
- Background scroll locked while open; Escape closes when safe; preserve keyboard/focus accessibility.
- Hide empty/NA details where possible.
- Show full chassis/engine values in the review when returned and approved for use, but never log/commit them.
- Existing Insurance section must be clearly reference-only.
- `Use These Details` is the main action with per-group checkboxes selected by default; preserve manual values/conflict awareness rather than silently overwriting.
- Applied verification carries transaction IDs/timestamps to the server for verification metadata storage.

### Policy OCR current UI requirements

- Keep a single compact header action `Read Policy Copy` beside the main booking action.
- The old standalone full-width OCR upload section must remain removed.
- Modal flow contains file selection, OCR progress, warnings/errors, extracted field review, confidence, individual selection, Cancel, and Apply Selected Details.
- OCR values are proposals; saving happens only when the user ultimately books/updates the policy.

### Validation and verification discipline for this workflow

- Policy Onboarding is a React-controlled client form with server actions/RPC, not the fragile POSP/MISP `submitPath` route-post form. Do not incorrectly apply the route-post “no React handlers” rule to this component; instead preserve controlled state and server-authoritative validation.
- When programmatically changing controlled inputs, update React state directly wherever possible. A previous Lead Source bug occurred because a native listener changed the dependent Intermediary Code before React accepted the controlled Lead Source value, causing a re-render that restored the old empty source. Do not reintroduce DOM-level synthetic synchronization when the component can own the state.
- After material UI logic changes, run `npm ci`, `npm run typecheck:web`, `git diff --check`, and focused assertions/tests where available before claiming implementation success.
- Typecheck success is not production-deployment evidence.
- After explicit deployment, verify the exact production trigger commit reaches final Vercel success before claiming the page is live.

### Current refinement direction / next-session expectation

The user is actively redesigning Policy Onboarding one section at a time. Sections 01 and 02 have been compacted and production-deployed as described above. Future agents should:

- Start from the current deployed/current-main implementation, not screenshots of older layouts.
- Ask before changing business logic when the request is about layout only.
- Keep reducing vertical space without sacrificing readability.
- Keep derived/calculated values visually distinct from editable controls.
- Reuse the compact metadata pattern from Section 01/02 where it genuinely clarifies a parent field.
- Avoid gratuitous cards, repeated descriptions, duplicated sidebar information, and disabled-input styling for non-editable calculated values.
- Preserve existing AuthBridge/OCR/database behavior while refining layout unless the user explicitly requests a workflow or schema change.
'''

path.write_text(text.rstrip() + '\n\n' + section.strip() + '\n', encoding='utf-8')
