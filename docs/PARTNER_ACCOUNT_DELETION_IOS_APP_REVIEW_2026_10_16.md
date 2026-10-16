# INSUREIT Partner — Account deletion request workflow (16 October 2026)

## Scope and release state

Implementation in branch `feat/partner-account-deletion-request-ios-20261016`. Not merged, deployed, migrated, published OTA or built. Designed to be OTA-compatible with existing 0.2.0 Partner runtime; do not publish until server deployed + schema verified. Apple review of iOS 0.2.0 (3) is already underway (Guideline 2.1 Information Needed). Do not claim feature is live until real iPhone verified.

## Behavior

- Native Settings → Request account deletion opens in-app privacy page.
- Authenticated user may request deletion by explicitly confirming system dialog. Browser cookies alone are not accepted as authorization; API requires Supabase Bearer token.
- Backend resolves session user via `auth.getUser(token)`, then `partner_app_current_identity`, never trusts a supplied user ID.
- Migration creates `partner_account_deletion_requests` with RLS enabled, service-role-only access, timestamp/status, unique open request per Auth user.
- Requests are logged, not automatically executed; GET returns only the requesting Auth user’s latest status.
- Users are informed that eligible personal information will be removed upon verified fulfillment, while appropriate historical insurance/claim/finance/regulatory records may remain subject to legitimate retention requirements.
- No Auth users, Partner organization records, insurance policies, claims, customers, audit, login profiles or storage objects are deleted by this change.

## IT-only operational review queue

`GET /api/admin/partner-deletion-requests` shows latest 100 records to logged-in IT Super Users only, including identity references and statuses. `PATCH` supports `start_review` (requested → under_review) and `decline` (under_review → declined, mandatory reason), and records reviewer ID and review timestamp. It intentionally offers **no fulfilled transition or user deletion**. Privacy administrator must arrange secure identity handling and request acknowledgement, plus real deletion fulfillment before launch. This API has no admin UI yet.

## Operations prerequisite — before public launch

1. Verify current production database migration status and relations/read-only. Run migration only with separate approval and backup strategy.
2. Designate privacy administrator and documented request intake processing procedure; check queue frequently.
3. Fulfill through approved manual runbook after identity verification and dependency/foreign-key audit; terminate sessions, disable logins, remove/anonymize eligible personal data, remove push registrations, preserve legally retained business records.
4. Inform requester of receipt, expected timeline, exceptions/retention and final outcome. Use secure communication and auditable completion.
5. Add reviewed administrative queue tooling and protections before declaring end-to-end *fulfillment* complete.
6. Verify server endpoint rejects anonymous and forged IDs; duplicate submission is idempotent; test under employee, partner and associate identity; perform actual iPhone regression; don't use production personal records for destructive tests.
7. Review Apple's App Store Guideline 5.1.1 and legal retention obligations. Since Apple requested a physical-device demo, record the app *after* an actual compatible OTA if Apple agrees to review it, and disclose the OTA.

## Technical files

- `apps/partner-app/app/account-deletion.tsx`
- `apps/partner-app/lib/account-deletion.ts`
- `apps/partner-app/app/settings.tsx`
- `apps/web-portal/app/api/partner/account-deletion/route.ts`
- `supabase/migrations/20261016130000_partner_account_deletion_requests.sql`
- `supabase/rollbacks/20261016130000_partner_account_deletion_requests.sql`

## Safety caveat

This is an **in-app deletion request** with backend intake only. It does not complete physical deletion; formal admin fulfillment and notification remain pending. Do not misrepresent this as automated self-service deletion to Apple. Rollback SQL deletes request records; never run on production after genuine requests exist without proper archival/legal verification.
