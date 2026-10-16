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

## Read-only deletion safety preflight

`GET /api/admin/partner-deletion-requests/preflight?id=<request-uuid>` is limited to IT Super Users. It inspects the pending request’s Auth-linked portal accounts, associate accounts, profile/employee references and the existing `admin_hard_delete_blockers` function without writing data. It ALWAYS reports `safe_to_auto_delete: false`; a zero-blocker result is not permission to delete. No automatic fulfillment endpoint exists. The profile identity may be shared with Operations login, and partner business records must remain intact.

**Verification matrix before production:** anonymous user => 403; regular Partner user => 403; IT Super User + invalid UUID => 400; nonexistent request => 404; admin + valid request => scoped read-only inspection; database error => 503; ensure no writes. Test subordinate/associate accounts and cases with attached business history. Do not use a real user for destructive QA.

## Administrator review interface

`/system/partner-deletion-requests` is a server-authorized IT Super User workspace with the most recent 100 requests, read-only dependency inspection and explicit `requested -> under_review -> declined` handling. The PATCH endpoint enforces same-origin requests. Neither the UI nor the API offers a `fulfilled` transition or Auth deletion. The permanent-delete facility elsewhere in the portal must **not** be used as a substitute for reviewed privacy fulfillment.

Before allowing live requests, designate a reviewer and secure way to acknowledge and notify requesters. Establish a verified procedure to detach eligible Auth identity data without cascading into partner, policy, claim, accounting or audit histories. A user may have both employee and intermediary credentials; review all login types and dependent foreign keys. The user-facing feature must not be described to Apple as automatically deleting all account data.

## Fulfillment safeguards — 16 October follow-up

- New additive migration `20261016153000_partner_deletion_fulfillment_safeguards.sql` adds optional verification, approval, notification and fulfillment-reference fields and a service-role-only append-only event table.
- Database trigger rejects changing request status to `fulfilled` unless identity verification, retention review, authorization, completion communication and an external fulfillment reference are recorded. These metadata fields alone do not prove Auth deletion and must never be used to bypass actual execution evidence.
- **No automated Auth deletion endpoint has been enabled**: safety preflight always returns `safe_to_auto_delete: false`. Deleting `auth.users` can cascade into portal associate accounts and attached data; account disabling alone is not deletion. A bespoke identity detachment strategy with live schema inspection is needed before implementing deletion.
- Administrator must send requester confirmation only after verified completion; no SMTP provider is connected to this workflow. The current `notification_sent_at` field is reserved for future verified delivery receipts.
- Both migrations are unapplied; earlier migration already defines `fulfilled` enum/status value for future use, but UI has no transition to fulfilled.
- Do not merge/deploy these as evidence of end-to-end compliance until the fulfillment executor, test fixtures, notification transport, and approval procedure exist.

## Production schema evidence (READ ONLY, 16 October 2026)

The linked INSUREIT production Supabase project `ilzhsfqqjyppzzvfscmh` was checked with read-only information_schema queries; **no customer rows, auth identities or secrets were retrieved**. Important foreign-key shape:

- `profiles` has **25 RESTRICT**, **25 NO ACTION**, **9 CASCADE**, **82 SET NULL** referencing foreign keys in public schema.
- `intermediary_portal_accounts` has **1 RESTRICT** reference (policy intake requests) and **2 SET NULL** references.
- `partner_portal_associate_accounts` has **1 SET NULL** reference.
- Consequently direct profile/Auth deletion may be blocked or cause unwanted cascades. Disabling access alone is not adequate deletion, while bulk detachment without lawful retention mapping is unsafe. Do not run `auth.admin.deleteUser` until live FK and shared-login dependency checks plus approved cleanup steps are satisfied.
- Data above is schema aggregate only, not proof of counts for any specific user.

## Auth user cascade assessment (production, read-only)

Live PostgreSQL `pg_constraint` inspection confirmed `auth.users` ON DELETE CASCADE on `profiles`, `partner_portal_associate_accounts`, `group_portal_associate_accounts`, `partner_learning_attempts`, in addition to Supabase Auth internals. `intermediary_portal_accounts` reference is SET NULL. This means even when profile blocker queries return no protected references, directly deleting Auth may silently destroy associate and learning records that carry business/audit value. The IT preflight now checks group associate account and learning attempt counts and lists the cascade risks. **safe_to_auto_delete remains false**. No Auth executor is enabled until targeted preserved-data identity detachment and full FK audit can be performed safely and verified with disposable test users.

Acceptance gates for executor: (1) prove all cascade dependencies for requested identity, (2) reject shared employee/other portal access without approved scope, (3) preserve and anonymize business history without FK mutation that causes cascade, (4) execute with idempotent review and independent IT approval, (5) read-back that Auth access was revoked and login impossible, (6) ensure no data loss, (7) send and confirm requester notification. No source-only code or check can substitute for test identity and real deployed end-to-end evidence.

## Guarded identity-only executor (NOT production-enabled)

- `POST /api/admin/partner-deletion-requests/fulfill` is implemented for a narrow cohort of isolated primary intermediary logins. Requires IT Super User, exact confirmation, retention affirmation, `under_review` request, exact portal linkage, no profile, partner/group associates, learning attempts or profile blockers. It suspends the Auth login, detaches/disables only the portal-account login reference, deletes Auth identity and uses the existing Resend email provider for completion notice; then records fulfillment only after successful delivery acceptance.
- Fail-closed release kill switch: `PARTNER_DELETION_EXECUTION_ENABLED` MUST equal `true`. It is intentionally unset by default. This destructive executor has **not** been tested against an isolated disposable identity, and additional Auth foreign-key dependencies remain possible. NEVER enable on production before full dependency proof, disposable-account end-to-end tests, retained-data comparison and explicit live release approval.
- A partial failure after suspend/detach/delete requires manual recovery; the route returns an error and leaves request in `under_review`. This is not transactionally atomic across Supabase Auth, PostgREST, Resend. Do not claim end-to-end verification from CI.
- The administrative review page now surfaces a multi-step confirmation. It will report disabled state before any destructive write until the kill switch is explicitly enabled.
- Technical verification must cover blocked shared and linked identities, retry after partial failure, provider outage, status transitions, no data loss, token revocation and failed login on a disposable account. Verify policy intake/history totals before and after.
- No database migration, production server deploy, configuration enablement or OTA has occurred.

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
