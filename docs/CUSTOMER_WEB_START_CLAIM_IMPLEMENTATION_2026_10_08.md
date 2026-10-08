## 2026-10-08 — Customer Web claim/create/9-stage parity implementation (PR #2970)

- Branch: `feature/customer-web-start-claim-phase1-2026-10-08`; draft PR #2970; **implemented on branch, NOT MERGED, NOT DEPLOYED, RUNTIME UNVERIFIED**.
- Customer-only protected routes: `/customer/start-claim`, `/customer/add-vehicle`, `/customer/add-policy`, `/customer/spot-intimation`, `/customer/claims/[id]/stage/[stage]`.
- Vehicle creation uses `create_customer_vehicle_v2` via authenticated Customer RPC with customer-account validation; RC lookup reuses the existing authenticated `/api/customer/rc-lookup` AuthBridge route.
- External policy creation uses existing `create_customer_external_policy` RPC, class-aware product selection, active-policy prevention, 5 MB copy upload and customer document metadata.
- Internal managed claim creation prepares a Draft then Spot Intimation advances to `Initial Documents Pending`; external self-tracked claim uses `ensure_self_managed_external_claim_draft` and `finalize_self_managed_external_claim_draft`. No Operations-owned status is editable by later stage forms.
- Nine-stage customer drilldowns use `INTERNAL_JOURNEY_STAGES`; permitted external self-managed updates use `save_self_managed_milestone` or mobile-matched direct customer milestone upsert for Spot Status/Vehicle Delivery. Stage date, sequencing, role, and ownership validation are enforced.
- Customer evidence upload to `claim-documents` and `claim_documents` has format/size checks and storage cleanup; no verified document deletion.
- Exact mobile Start Claim hero/footer and 9 stage icons copied from original blobs; web catalog manufacturer/insurer logos reused.
- Known gaps to verify before considering release: complete UI parity and all mobile form details, internal/external real-account end-to-end tests, RC errors/registration edge cases, upload RLS/runtime behavior, and customer authorization regressions. GitHub verification must pass latest head. No APK/AAB.
- Detailed continuity: `docs/CUSTOMER_WEB_START_CLAIM_IMPLEMENTATION_2026_10_08.md`.

---

## Implementation update — 2026-10-08 (follow-on)

**IMPLEMENTED ON BRANCH / NOT MERGED OR DEPLOYED:**
- Customer Add Vehicle UI with owner-scoped mobile-family `create_customer_vehicle_v2` RPC; currently basic registered vehicle fields only.
- Customer Add Policy UI with owner-scoped `create_customer_external_policy` RPC, current-policy guard, insurer/date validation, policy copy upload to `customer-documents` and `customer_documents` metadata.
- Start Claim now allows customer-scoped preparation of internal Draft or external self-managed draft via `ensure_self_managed_external_claim_draft`, after policy/vehicle/account membership checks, with active-claim reuse.
- Customer Web Spot Intimation form: external uses `finalize_self_managed_external_claim_draft`, internal Draft advances to initial-documents-pending using the Customer App’s claim fields, keeping other internal stages Operations-controlled.
- Nine-stage deep-link navigation under `/customer/claims/[id]/stage/[stage]`; authenticated customer ownership verified for each stage; informational stage detail, not unrestricted milestone writes.
- Original Customer App hero and footer image blobs copied to `apps/web-portal/public/assets/customer-claim` without alteration.

**STILL NOT COMPLETE / NOT CLAIMED AS FULL MOBILE PARITY:**
- RC lookup, registered/unregistered add-vehicle variants, class-aware capacity/permit/compliance details and cross-account duplicate handling.
- Full vehicle manufacturer/insurer logos across claim UI and exact icon parity in every stage.
- Full Spot Intimation media/voice/photo uploads and document retry handling; add-vehicle policy-in-same-flow.
- All nine individual stage-specific writable external forms and authorised internal customer document upload flows.
- Accurate managed/external end-to-end browser validation and real device-size screenshot comparison.
- Dedicated customer route regressions and GitHub CI verification for these new changes.

**Release boundary:** Do not merge as full feature-complete parity until the remaining workflows are implemented, checks pass, and Customer Web runtime behaviour is verified. No APK/AAB, schema/RLS, Partner/Operations mutation, OTA, merge or deployment in this implementation.

---

# Customer Web Start Claim — Implementation Continuity (2026-10-08)

## Scope and evidence
Branch: `feature/customer-web-start-claim-phase1-2026-10-08`.
Evidence: **IMPLEMENTED (phase 1 selector only); PR/CI/MERGE/DEPLOYMENT/WEB RUNTIME UNVERIFIED**.

Customer Web route `/customer/start-claim` is introduced under the already protected `apps/web-portal/app/customer/(protected)` namespace. This page uses `resolveCustomerWebScope`, `loadCustomerWebVehicles`, `loadCustomerWebPolicies`, and `loadCustomerClaims`. It reuses the authenticated customer-scoped data loaders and RLS boundary rather than introducing administrative access.

Current functionality:
- Vehicle selection with client-side search and account-scoped vehicle list.
- Policy context, internal/external label, date status, external policy number masking.
- Existing active claim detection and linking to the existing Customer Web claim detail.
- Home Quick Actions `Start claim` link to the new selector.
- Assistance link to the existing customer Support route.
- No claim creation, milestone mutation, document upload, policy creation or vehicle creation.

## Explicit blocked / not implemented items
- Real claim creation, including secure internal Draft, Spot Intimation, self-managed external claims, status transitions and idempotent existing-claim protection.
- Stage-specific, nine-step interactive forms and document uploads.
- Customer Web Add Vehicle and Add Policy creation forms and corresponding server-side operations.
- Genuine Customer App icon/illustration parity (web-safe source asset copying and precise visual verification still needed).
- Add Policy button currently links to the policies register to avoid broken navigation; new policy creation is not claimed.
- Assistance currently opens the existing Support page and is not the direct claim-assistance mutation.

**Do not merge and market this branch as complete Customer App functionality.** The selector alone is not production-ready parity.

## Next required phases
1. Audit current mobile claim creation and database RPC/RLS; add server-authoritative Customer Web claim creation and prevent duplicates across retries/concurrency; preserve source and service-mode isolation.
2. Add customer-owned Vehicle and External Policy creation with canonical validations/RC lookup, insurer matching, document handling, storage authorization and active-cover conflict protection.
3. Add Spot Intimation forms with date/time validation, upload retries, optional media and idempotent persistence.
4. Add claim stage pages reusing `@insureit/claim-journey`: internal Operations-owned status read-only while customers upload allowed documents, external self-managed milestones writable only within existing contracts; broker-managed assistance conversion remains Operations-controlled.
5. Add web-safe asset parity, regression tests, browser/mobile viewport tests, and GitHub Verify web portal CI. No APK/AAB.

## Preserved boundaries
No Partner/Operations code changes, no new RLS/schema/API mutation, no mobile runtime changes, no APK/AAB, no merge or deployment in this implementation slice.
