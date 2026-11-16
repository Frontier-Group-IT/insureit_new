# INSUREIT AI Policy Onboarding — n8n read-only preview for all open Motor Intakes

## Approved request (16 November 2026)

Expose **Preview n8n PDF** for every Motor Intake in the existing Development → AI Policy Onboarding workspace, including records marked Duplicate in the Policy Intake Review page, without manual PDF download or booking. The existing n8n extractor has been trained for digitally readable ICICI Lombard Product Code 3005 PDFs only. Other insurer layouts may return an unsupported extraction error and must **not** be treated as valid or bookable. This is an opt-in preview-only expansion, not a mass OCR/auto-booking rollout.

## Code behavior

- AI workspace loads all Motor Intakes with stored status `processing`, `ready_for_review`, `needs_attention` or `in_review` **before pagination**. It displays derived Duplicate status rather than hiding duplicates. A duplicate remains **Preview only**; the UI disables correction/booking, and canonical server-side duplicate/booking controls remain intact.
- Direct selection URL: `https://portal.insureit.in/development/ai-policy-onboarding?intake_id=<UUID>`. The server validates a proper UUID and selects it only if present among its loaded Motor Intake rows; it resolves the correct page before passing the selection. The client does not trust arbitrary IDs, and merely opening this URL sends no PDF to n8n.
- The n8n preview button is displayed on authorized open Motor Intakes only when `INSUREIT_N8N_OCR_MODE=shadow` and `INSUREIT_N8N_OCR_PREVIEW_ALL_MOTOR=true`. The old exact-UUID allowlist continues for pilots without this flag and for `prefer`/required-mode routing; **do not change required OCR routing or Google fallback behavior**.
- The preview server action still requires Development `manage_system:approve`, IT Super User/Super Admin, and canonical per-Intake reviewer/finalizer permissions. It independently checks stored Motor status, the current private PDF in Supabase Storage, matching document/version, file MIME, size <=15MB, signed 120-second URL, n8n authentication and parsed response validation. No client-supplied Storage URL is fetched.
- The broader preview flag is **only effective in shadow mode**. In shadow mode, `INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY=false`; no OCR apply/overwrite, Intake status change, reviewer assignment, customer/vehicle/policy creation or booking occurs. Duplicate corrections and booking remain blocked.

## Production Vercel activation

Project `insureit_new` on team `antnish1s-projects`, production domain `portal.insureit.in`.

1. Review the new PR and confirm both GitHub checks pass. Merge **only with user approval** and use the owner's manual Vercel Production deploy process.
2. Set Production `INSUREIT_N8N_OCR_MODE=shadow` (already configured), add `INSUREIT_N8N_OCR_PREVIEW_ALL_MOTOR=true`, keep `INSUREIT_N8N_OCR_AUTO_ICICI_3005=false`, `INSUREIT_N8N_OCR_ALL_MOTOR=false` and `INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY=false`. Existing `INSUREIT_N8N_OCR_HEADER_SECRET` remains a Vercel Sensitive variable. Do not print it.
3. Manually redeploy the reviewed commit with the Vercel Production variables. Opening a specific Intake with `?intake_id=...` should show the selection and **Preview n8n PDF** in AI Booking Check, even for a derived duplicate.
4. Click Preview for an authorized ICICI 3005 Motor Intake. Verify n8n's `Download Current Private PDF` executes, compare name, policy number, dates, vehicle and OD/TP/CPA/IGST/gross premium to the PDF, and confirm the live Intake/draft/policy rows do not change.
5. On a different insurer's policy, preview may fail with a parser-not-supported response. No fallback to Google on the manual n8n preview itself; the **existing automated intake OCR route is unchanged** and continues its prior Google fallback until separately trained.
6. To disable broad preview, set `INSUREIT_N8N_OCR_PREVIEW_ALL_MOTOR=false` and manually redeploy; or set `MODE=off` to disable all n8n preview/routing.

**Scope:** all *open Motor* Intakes in AI Policy Onboarding, including duplicate, assigned, failed OCR and processing. Completed/rejected policies and Life/Health/Non Motor are outside this Motor booking workspace and remain excluded. No automatic policy booking.
