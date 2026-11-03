# Policy issuance date and email OTP approval — 2026-11-03

## Requirements and status
- Current-month issued policies: unrestricted.
- Previous-month issued policies: unrestricted through the 15th of current month (Asia/Kolkata).
- From the 16th, previous month requires verified email OTP.
- Older-than-previous-month issuance requires verified email OTP at any time.
- Existing policy edit requires approval **only if the issuance date is changed** to a restricted earlier month. Ordinary changes to a historical policy are not blocked.
- Future-month issuance is rejected. Life/Health **proposal sourcing dates** are not policy issuance dates; the date rule applies to issuing/converting the policy, not opening a proposal.
- Configured approvers: Jatin Kumar Buwaniwala <jatin.garg@insureit.in>, Vishal Kochhar <vishal.kochhar@insureit.in>, Varun Sabharwal <varun.sabharwal@insureit.in>, Gagan Singh <gagan.singh@insureit.in>.

## Code
- `apps/web-portal/lib/policy-date-rule.ts`: shared IST month-boundary calculation.
- `apps/web-portal/app/policies/policy-date-approval-actions.ts`: server-side send/verify; HMAC-hashed six-digit OTP, 5-minute expiration, 5 attempts, 1-minute resend cooldown, 8 requests per hour; fixed email allowlist.
- `apps/web-portal/components/policy-date-approval-widget.tsx`: approver selection, send, verify UI with clear status/errors.
- Motor onboard/create/replacement/intake and edit: `save_motor_policy_with_date_approval_v1` wrapper, requiring single-use verified grant consumed **in the same DB transaction** as the existing canonical motor-save RPC.
- Non-Motor create/edit: server-side approval preflight and one-time atomic claim before saving; audit event after successful policy workflow.
- Life/Health policy issuance/conversion: server-side one-time approval preflight; proposals themselves unchanged.
- Issued Life/Health policy edit: changing the issuance date to a restricted earlier month requires new OTP; unchanged historical dates stay editable.
- Activity Status: `previous_month_policy_uploaded` event with uploaded-by, date and OTP approver (when required).

## Required deployment configuration (NOT in repo)
- Verified email sender in Resend (domain and SPF/DKIM/DMARC).
- `RESEND_API_KEY` (server-side secret)
- `POLICY_DATE_OTP_FROM` (verified sender address)
- `POLICY_DATE_OTP_SECRET` (random >=32-character server-side secret; keep stable across all instances)
- Add above only to the deployment secret store; no NEXT_PUBLIC prefix. No emails can be sent until configured.

## DB schema and approval
Migration: `supabase/migrations/20261103114500_policy_issuance_email_otp_approval.sql`.
- `policy_date_otp_approvals` is RLS-enabled and not available to anon/authenticated; only service_role may read/write.
- The motor transaction wrapper is only executable by service_role; caller's identity supplied from an already-authorized server action and matched to OTP approval.
- OTP never stored in plaintext and never returned by server actions.
- Consumed approvals cannot be reused; approver attribution is persisted via audit log.
- Do not apply migration without explicit approval. Ensure schema deployed BEFORE the web code.
- Non-Motor and Life/Health currently use sequential Supabase writes (existing architecture), so if an authorized attempt fails after approval is claimed, the user may need a NEW OTP to retry. This is a fail-closed constraint; production QA should verify cleanup/retry and consider future consolidation into a transactional RPC.

## Test checklist
- 15 vs 16 boundary, December/January, older-than-previous-month, current-month free, future-month and invalid-date rejection.
- Standard current-month create/edit, previous-month by 15, previous-month after 15 with OTP, arbitrarily older policy with OTP.
- Edit old policy without changing issuance date: no OTP; changing issuance date to restricted month: OTP.
- Email success/error, code expiry, wrong OTP, 5 tries, cooldown, replay, forged approval ID, changed policy number/date, concurrent approval claims, identity mismatch.
- Motor create/intake/replacement/edit; Non-Motor create/edit; Life/Health proposal creation (unaffected) and issued conversion.
- Existing OCR, documents, customer/vehicle association, duplication checks, full activity history, approval attribution, permissions/RLS.
- No policy write if OTP required but missing or not verified.
- CI `Verify web portal` and manual authorized test accounts against non-production DB and email sender before production rollout.

## Release gates
Separate branch / PR only. No merge, deployment, migration application, OTP emails sent, or APK/AAB creation without user approval. Migration must be verified against the production-equivalent schema and dry-run tests before rollout.
