# Web Portal Current-State Readiness Audit

Date: 23 July 2026

Scope:

- `apps/web-portal`
- Web-facing Supabase migrations, policies, storage, and server actions
- Current branch: `work/posp-misp-approval`
- Mobile application excluded

## Executive Verdict

The portal builds and type-checks, and its core customer, vehicle, policy, claim, and onboarding surfaces are present. It is not ready for the next major implementation phase yet. The current priority should be a stabilization milestone covering security, authorization, workflow completion, truthful analytics, route integrity, pagination, and automated quality gates.

The most serious blockers are:

1. POSP/MISP applications can be submitted but cannot be approved.
2. Training passwords and bank account numbers are stored and displayed in plaintext.
3. Excel imports preserve sensitive raw source data and use a vulnerable, unmaintained parser.
4. Authentication stores a refresh token but never refreshes the access token.
5. Navigation contains links and filters that lead to missing routes or do nothing.
6. Dashboard charts and ageing buckets can visually misrepresent real data.
7. There are no automated tests or CI checks, and production builds explicitly skip lint.
8. Most large lists load the full dataset into memory and will degrade as records grow.

## Stabilization Progress

Completed on `work/posp-misp-web-onboarding`:

- Replaced the claims-only dashboard with an RLS-scoped operations overview backed by a database aggregation RPC and indexed fallback queries.
- Restored lint as a production build gate and aligned the TypeScript ESLint packages.
- Configured the correct Next.js output tracing root.
- Protected notifications, settings, and claim-document routes in middleware.
- Added refresh-token rotation and clean expired-session recovery.
- Restricted login return URLs to known internal portal routes.
- Added baseline CSP, HSTS, clickjacking, MIME-sniffing, referrer, and permissions headers.
- Replaced the access-denied login loop with an explicit sign-out-and-switch-account flow.
- Corrected broken notification customer/support destinations and invalid claim sidebar filters.
- Made Tasks and Timeline search/status controls functional and removed unsupported report filters.
- Added transaction-safe POSP/MISP approval with one or two customer logins based on distinct MISP mobile numbers.
- Removed bank account and training password values from general review payloads and masked historical review values.
- Added truthful POSP/MISP batch states and counts, failed-row retry, concurrency-safe row claiming, and safe failure references.
- Added row-level import document uploads and made education/marksheet status derive from the attached certificate.
- Enforced optional external onboarding IDs in `SIB/YYYY/MM/NNNN` format with concurrency-safe duplicate protection.
- Replaced full-table KYC and POSP/MISP queues with indexed server-side search, filters, grouped document counts, ageing and pagination.
- Replaced the legacy Excel parser with a maintained `.xlsx` reader and strict archive, file-size, row, column, and cell limits.
- Rejected workbook formulas, macros, unsafe archive paths, and external workbook links before parsing.
- Patched Next.js to `15.5.21`, restored a clean reproducible dependency lock, and aligned the portal lint toolchain.

Still open:

- Managed encryption and audited reveal access for POSP/MISP credentials and bank account numbers.
- Formal import-file retention rules and asynchronous worker isolation for unusually large future import volumes.
- Server pagination and indexed search for the remaining customer, vehicle, policy, document, task and timeline queues.
- Claim workflow consolidation, transaction hardening, automated tests, CI, and observability.

## Validation Results

| Check | Result | Required action |
| --- | --- | --- |
| TypeScript | Pass | Keep as a required CI check. |
| Next.js production build | Pass | Keep as a required CI check. |
| ESLint | Pass | Keep as a required CI check. |
| Production dependency audit | Direct Next and `xlsx` findings resolved; 3 transitive advisories remain | Track patched Next releases for bundled PostCSS and Sharp updates. |
| Automated tests | None found | Add unit, database/RLS, integration, and Playwright suites. |
| Route loading/error boundaries | None found | Add scoped `loading.tsx`, `error.tsx`, and `not-found.tsx`. |
| CI workflows | No `.github` directory | Add required GitHub Actions checks before merge/deploy. |
| Observability | No instrumentation found | Add structured logs, error tracking, metrics, and correlation IDs. |
| Build workspace detection | Pass | Keep the workspace tracing root configuration. |

## P0: Security And Data Protection

### Plaintext credentials and financial data

Observed:

- `posp_misp_onboarding_profiles.training_password` is plaintext.
- Bank account numbers are plaintext.
- Application review displays the full training login/password and account number.
- Parsed-row editing renders these values in ordinary text inputs.

Required solution:

- Encrypt sensitive values with a managed KMS or envelope encryption.
- Store only masked bank metadata and last four digits in normal query surfaces.
- Provide an audited, permission-gated reveal action with re-authentication.
- Prefer a credential issuance/reset workflow over retaining reusable passwords.
- Prevent secrets from entering application `draft_data`, import `source_data`, logs, URLs, or client payloads.

### Sensitive Excel data is duplicated

Observed:

- Import batches keep complete source rows and normalized rows.
- Submitted onboarding profiles can also keep raw import data.
- Aadhaar is hashed in normalized fields, but the raw source can still retain the original number.

Required solution:

- Sanitize every row immediately after parsing.
- Retain Aadhaar hash plus last four only.
- Encrypt unavoidable credentials and bank details.
- Define retention and purge rules for uploaded workbooks, raw rows, failed imports, and rejected applications.

### Excel parsing attack surface

Observed:

- `xlsx` has unresolved high-severity advisories.
- A global 25 MB Server Action body limit applies to every action.
- Workbooks are parsed synchronously in the request.
- No job isolation, parser timeout, or strict row/column budget is present.

Required solution:

- Replace `xlsx` with a maintained parser or isolate it in a constrained worker.
- Validate file signature, extension, MIME type, size, sheet names, row count, and column count.
- Reject macros, formulas where not needed, external links, and unsupported sheets.
- Process imports as background jobs with progress and retry state.
- Use a smaller default action limit and a narrowly scoped upload endpoint.

### Authorization is fragmented

Observed:

- Middleware omits `/notifications`, `/settings`, and `/claim-documents`.
- Some pages self-guard, while others rely on RLS or middleware.
- POSP/MISP tables permit all operations to several broad manager roles.
- Service-role actions bypass RLS and therefore depend entirely on action-level checks.

Required solution:

- Create one explicit route policy map and protect every staff route.
- Require authorization again at the start of every server action and document endpoint.
- Narrow POSP/MISP permissions into view, edit, review, approve, import, and secret-reveal capabilities.
- Add database tests for every role/table/action combination.

### Missing security headers and upload controls

Observed:

- No Content Security Policy or other explicit production security headers are configured.
- Claim replacement uploads do not visibly enforce a shared MIME/size policy before storage.

Required solution:

- Add CSP, HSTS, `frame-ancestors`, `X-Content-Type-Options`, Referrer-Policy, and Permissions-Policy.
- Centralize allowed file types, maximum sizes, filename normalization, malware scanning, and quarantine.
- Audit every signed URL generation and record sensitive document access.

## P0: Authentication And Session Lifecycle

### Refresh token is never used

Observed:

- Login stores access and refresh token cookies.
- Server clients and middleware read only the access token.
- An expired access token becomes an access-denied result even when a valid refresh token exists.

Required solution:

- Migrate to the official Supabase SSR cookie client.
- Refresh and rotate sessions in middleware.
- Clear invalid cookies and distinguish expired sessions from forbidden roles.
- Add tests for expiry, refresh, logout, inactive users, and revoked sessions.

### Login return URL is not strictly validated

Observed:

- A value beginning with `//` passes the current leading-slash check and can act as an external protocol-relative redirect.

Required solution:

- Accept exactly one leading slash.
- Reject `//`, backslashes, schemes, control characters, and unknown route prefixes.

### Access-denied recovery is incomplete

Observed:

- The administrator email is `admin@example.com`.
- “Back to login” does not clear an existing unauthorized session and can return the user to access denied.

Required solution:

- Use the real support/security contact.
- Add “Sign out and use another account.”
- Explain inactive, unauthorized, and expired-session states separately.

## P0: POSP/MISP Workflow Completion

### Approval is impossible

Observed:

- The application review page supports approval only for individual/proprietor, group, corporate, and dealership.
- POSP and MISP are viewable but not reviewable or approvable.

Required solution:

- Implement dedicated POSP/MISP review actions.
- Transactionally create the customer, profile/user memberships, contacts, and partner profile.
- For MISP, create two user identities when normalized mobile numbers differ and one when they match.
- Record reviewer, decision, checklist, timestamps, and audit events.
- Make approval idempotent and safe to retry.

### Document status is not truly document-derived

Observed:

- Manual onboarding derives education status from a file.
- Excel parsing derives it from spreadsheet text.
- Parsed-row editing exposes “Education / Marksheet Status” as an editable dropdown.
- Imported rows have no row-level document attachment flow.

Required solution:

- Remove the editable status.
- Add row-level document attachment before submission.
- Derive “received” only from an existing, accepted document record.
- Show missing-document validation per row.

### External IDs are not governed

Observed:

- Onboarding/MISP IDs can remain blank, which matches the current business decision.
- Supplied values have no visible format or uniqueness enforcement.

Required solution:

- When present, validate `SIB/YYYY/MM/NNNN`.
- Add a partial unique index for non-null IDs.
- Preserve manual/excel entry until system generation is introduced.

### Import batch states are misleading

Observed:

- Rows submit one by one and failures are caught.
- The batch is marked submitted even when some rows fail.
- Valid/invalid counters do not represent pending/submitted/failed outcomes after processing.
- There is no idempotency key or “retry failed rows” workflow.

Required solution:

- Add `processing`, `partially_submitted`, `submitted`, and `failed`.
- Track pending, submitted, failed, removed, and invalid counts separately.
- Use `batch_id + row_id` as an idempotency boundary.
- Support retrying failed rows without duplicating successful applications.

## P1: Navigation And Shared Shell

### Broken or inert destinations

Observed:

- Notification/support links target `/support/[id]`, but no web support route exists.
- Customer activity links target `/customers/[id]`, but the route is `/customers/[id]/edit`.
- Claims sidebar uses `stage=...`, while the claims page reads `queue`, `journey`, and `status`.
- Tasks and reports sidebar query parameters are ignored.
- Dashboard activity repeats the same broken support/customer paths.

Required solution:

- Introduce typed route builders shared by navigation, dashboard, and notifications.
- Build the support workspace or hide all support links until it exists.
- Add route-contract tests for every generated href.

### Search and filters that do nothing

Observed:

- Shared `SearchFilterBar` has no form, input names, state, navigation, or filtering callback.
- It is used on Tasks, Timeline, and Reports.
- The global header search is visual only.

Required solution:

- Use URL-driven GET filters or controlled router state.
- Implement server-side search and filter behavior.
- Remove global search until a cross-domain search endpoint exists.

### Fragile active navigation

Observed:

- Active sidebar state is inferred from page-title words.
- Settings, organization, users, and notifications can receive an incorrect or absent active state.

Required solution:

- Pass an explicit typed navigation key from each route or derive it from pathname.

### Shared shell adds repeated latency

Observed:

- Every page navigation loads profile data, customer count, KYC count, and up to 80 notification/activity records.

Required solution:

- Consolidate counters into a small RPC.
- Cache or stream non-critical shell counts.
- Fetch menu data only when the related surface opens.

### Accessibility gaps

Observed:

- Menus and modals lack consistent Escape, outside-click, focus-trap, and focus-return behavior.
- Many labels and data cells use 9.5–11 px text.
- Decorative text glyphs are used where a consistent icon system is expected.

Required solution:

- Use semantic dialogs and menus with keyboard handling.
- Adopt Lucide icons.
- Raise minimum readable font and target sizes.
- Add automated axe checks to Playwright.

## P1: Dashboard

### Charts are not truthful

Observed:

- The category doughnut always renders fixed 30/25/45 proportions while labels use live counts.
- The trend visualization is a static placeholder shape.
- Ageing buckets place an entire workflow count into a bucket based only on that workflow’s oldest item.
- “Top overdue” creates synthetic references such as `CLM-QUEUE-001`.
- Some totals combine workflow claim counts, action row counts, and category counts, risking double counting.

Required solution:

- Build real aggregate/time-series queries.
- Calculate ageing per claim/task, not from a group’s oldest label.
- Link overdue rows to actual claims or filtered queues.
- Define every KPI’s numerator, denominator, date range, and data freshness.
- Remove any chart that cannot yet represent its source data exactly.

### Dashboard links and labels need completion

Observed:

- Several “View all” and alert links return to dashboard anchors rather than a complete work queue.
- Some referenced anchor IDs are absent or ambiguous.

Required solution:

- Route alerts to Tasks, Claims, Notifications, or Support with exact filters.
- Add visible empty/error states for each dashboard data source.

## P1: Customers And Onboarding

### Customer lists do not scale

Observed:

- Customer, application, and POSP/MISP pages load complete datasets.
- Application document counts fetch every matching document and count in application code.

Required solution:

- Add server pagination, filtered counts, and indexed search.
- Use grouped database counts instead of transferring every document row.

### Creation and approval are not transaction-safe

Observed:

- Multi-step actions create Auth, customer, application, contact, membership, document, and storage records across separate operations.
- Error messages acknowledge states such as “customer was created, but onboarding could not be completed.”

Required solution:

- Validate first.
- Use one database RPC transaction for relational writes.
- Make operations idempotent.
- Use a staged upload/quarantine flow plus compensating cleanup jobs for storage/Auth side effects.

### Customer identifiers can collide

Observed:

- Several actions derive customer IDs from the last digits of `Date.now()`.

Required solution:

- Generate identifiers in PostgreSQL with a sequence and unique constraint.

### Form/master-data inconsistencies

Observed:

- Corporate/dealership location fields can still accept values independently of the selected location.
- POSP/MISP manual location is free text rather than the canonical India location source.
- Website dealership onboarding still classifies dealership as POSP/MISP while first-class POSP/MISP types now also exist.
- Several customer selectors show contact name only, making similarly named companies ambiguous.

Required solution:

- Store a canonical location ID and derive city/state/PIN server-side.
- Plan and document retirement or renaming of the legacy dealership subtype.
- Label customers with company name, contact name, customer code, and partner type.

### KYC queue lacks operational controls

Observed:

- No pagination, saved filters, reviewer assignment, SLA age, bulk assignment, or export.
- Review errors can expose raw backend messages.

Required solution:

- Add queue ownership, ageing, filter/search, pagination, decision history, safe error codes, and audit export.

## P1: Vehicles And Policies

### Full-table loading and client pagination

Observed:

- Vehicle and policy workspaces fetch the full visible table and paginate/filter in the browser.

Required solution:

- Move search, company filter, status filter, count, and pagination to server queries.
- Add indexes for registration number, policy number, customer, insurer, and expiry.

### Vehicle form needs business rules

Observed:

- Vehicle type is free text.
- Customer options are not visibly restricted to eligible active customer types.
- Commercial-only fields can be entered for any vehicle.
- Portal and mobile representations can therefore diverge.

Required solution:

- Use canonical vehicle-type values.
- Enforce conditional field requirements server-side.
- Filter active eligible customers.
- Add duplicate registration/chassis/engine checks with customer-safe conflict messages.

### Policy form is incomplete

Observed:

- Policy type is free text.
- Premium is not captured by the portal form.
- End date is not visibly validated against start date.
- Duplicate `PolicyForm` implementations exist.
- Policy/vehicle surfaces have edit routes but no dedicated read-only detail/audit routes.

Required solution:

- Consolidate one form.
- Use canonical policy types.
- Capture premium and validate amount/date rules.
- Add policy detail, vehicle detail, history, and renewal/version relationships.
- Distinguish endorsement/renewal from overwriting an existing policy.

### Insurer creation modal needs hardening

Observed:

- It lacks focus trap and Escape handling.
- URL/phone validation is weak.
- Any master-data manager using the policy form can create insurers inline.

Required solution:

- Restrict insurer-master creation permission.
- Validate and deduplicate insurer records.
- Add full accessible dialog behavior and audit events.

## P1: Claims And Documents

### Duplicate workflow implementations

Observed:

- Claim status, verification, spot survey, survey completion, and workspace logic exist in multiple action/component generations.
- A legacy general status action can accept any known status rather than enforcing the current state-machine transition.

Required solution:

- Remove unused generations.
- Keep one state machine and one authorization layer.
- Enforce allowed transitions in the database transaction.
- Add concurrency/version checks to prevent two reviewers advancing the same claim.

### Document access needs explicit authorization

Observed:

- A document-open route creates a signed URL using the current user’s database visibility.
- The route is not in the protected middleware list and has no explicit claim-workspace permission check.

Required solution:

- Add route protection and claim/document authorization.
- Audit every open/download.
- Apply short-lived URLs, content disposition, and safe MIME handling.

### Document, task, and timeline queues are incomplete

Observed:

- Documents, tasks, and timeline load all records.
- Documents have no search/filter/pagination or assigned reviewer.
- Task and timeline filters are decorative.
- Timeline date formatting depends on server locale/time zone.

Required solution:

- Add server pagination and real filters.
- Add task ownership, priority, SLA, overdue state, completion action, and bulk assignment.
- Standardize all dates to the business time zone (`Asia/Kolkata`) with shared formatters.

### Raw database errors reach users

Observed:

- Many claim/document pages and server actions render or throw Supabase messages directly.

Required solution:

- Return structured domain error codes.
- Log technical details server-side with a correlation ID.
- Show safe, actionable messages to users.

## P1: Users And Organization

### Staff user creation uses temporary passwords

Observed:

- Administrators enter a temporary password directly.
- There is no forced reset, invitation expiry, password generation, or copy-once behavior.

Required solution:

- Use invite/reset links or one-time activation.
- Require password change and MFA for privileged roles.
- Audit creator, role, manager, activation, and revocation.

### Organization hierarchy can be misrepresented

Observed:

- The page loads every profile permitted by RLS and builds the tree in memory.
- If the viewer node has no children, `buildTree` returns all roots rather than the viewer.
- No cycle/orphan diagnostic is shown.

Required solution:

- Return the authorized subtree from a database RPC.
- Return a leaf user as the leaf, not all roots.
- Prevent reporting-manager cycles and surface orphaned records to administrators.

### Roles and designations need governance

Observed:

- Designation options include overlapping labels.
- Role changes and manager changes lack visible approval/audit history.
- User list and direct-report counts are loaded without pagination.

Required solution:

- Move designations to governed master data.
- Add role-change approvals/audit events.
- Add server pagination and aggregated direct-report counts.

## P2: Reports, Settings, Notifications, And Support

### Reports is a placeholder

Observed:

- It contains four record counts and explicitly says reports will appear later.
- Search and report-view filters do nothing.

Required solution:

- Define the first report catalog before further feature work: claim ageing, turnaround time, insurer performance, renewal pipeline, document SLA, staff workload, onboarding funnel, and imports.
- Add date ranges, filters, CSV/XLSX export, and permissioned saved views.

### Settings is a placeholder

Observed:

- It explicitly says options will be available later.

Required solution:

- Hide it until requirements exist, or implement governed settings for SLA thresholds, document requirements, notification rules, master data, and branding with audit history.

### Notifications are not a complete work center

Observed:

- Links can be broken.
- Query errors are converted to an empty result in shared dashboard loading.
- Read/seen/in-progress semantics are not clearly separated.

Required solution:

- Implement reliable destinations, mark-read/assignment actions, filtering, pagination, and visible data-load failures.

### Support is missing from the website

Observed:

- Database support tickets and links exist, but no web support route is present.

Required solution:

- Build the staff support inbox/detail workflow or remove every web support link until it is available.

## P2: Reliability, Performance, And Maintainability

### No route-level resilience

Required solution:

- Add scoped loading skeletons that preserve the final layout.
- Add route-level error boundaries with retry.
- Add not-found pages for claim, customer, vehicle, policy, application, import batch, and document.

### No automated quality gate

Required solution:

- Fix dependency version alignment so lint runs.
- Remove `eslint.ignoreDuringBuilds`.
- Add GitHub Actions for install, typecheck, lint, unit tests, build, migration lint, and security audit.
- Protect `main` and require checks/review before merge.

### No test coverage

Required minimum:

- Unit: normalizers, validators, role capabilities, route builders, date/ageing logic.
- Database: RLS matrix, workflow transitions, approval transactions, ID uniqueness.
- Integration: onboarding, Excel import/retry, vehicle/policy save, claim progression.
- Playwright: login/session refresh/logout, navigation, search/filter, review/approve, document access.

### Dependency and configuration drift

Observed:

- Lint packages and Next versions are misaligned.
- Build warns about multiple lockfiles and inferred workspace root.
- `.env.example` omits the server-only service-role key required by current admin actions.
- Root README incorrectly states that the portal does not require a service-role key.

Required solution:

- Align versions and maintain one lockfile source.
- Set `outputFileTracingRoot`.
- Document `SUPABASE_SERVICE_ROLE_KEY` as server-only and required for portal admin actions.
- Never expose it through `NEXT_PUBLIC_*`.

### Missing observability

Required solution:

- Add structured server logs with request/action IDs.
- Add error tracking and release identifiers.
- Measure route latency, Supabase latency, import duration/failure, upload failure, approval failure, and claim-transition failure.
- Add alerting and a production incident runbook.

### Hard-delete utilities are unsafe

Observed:

- Delete actions exist for master records.
- Customer dependency checks do not cover every relationship, claim, document, membership, contact, activity, and application table.

Required solution:

- Replace normal hard delete with archive/deactivate.
- Show a dependency impact summary.
- Use FK restrictions and reserve audited purge for controlled retention workflows.

## Legal And Production Content Gaps

Observed:

- Security policy phone is “To be updated.”
- Privacy, terms, cookie, and fraud policy documents contain unresolved contact placeholders.
- Access-denied uses `admin@example.com`.

Required solution:

- Complete legal contacts, grievance officer, privacy contact, retention schedule, processor list, and policy effective dates.
- Obtain legal/security review before production publication.

## Recommended Stabilization Roadmap

### Milestone 1: Stop-ship security and workflow completion

1. Protect/encrypt POSP/MISP sensitive data and sanitize imports.
2. Replace/isolate the Excel parser.
3. Implement POSP/MISP approval and MISP identity deduplication.
4. Fix session refresh, open redirect, route protection, and document authorization.
5. Correct broken notification/support/customer links.

Exit criteria: no plaintext secrets in normal tables/payloads, all onboarding types can complete, session refresh works, and authorization tests pass.

### Milestone 2: Truthful operations

1. Replace fake dashboard calculations with database aggregates.
2. Implement real Tasks, Timeline, Reports, and header filters or remove them.
3. Consolidate the claim state machine and remove legacy actions/components.
4. Add idempotency, partial import states, and retry.

Exit criteria: every visible number/filter/action is traceable to real data and every route has a working destination.

### Milestone 3: Scale and resilience

1. Add server pagination/search to every large queue.
2. Add loading/error/not-found boundaries.
3. Add structured errors, observability, and audit events.
4. Replace hard deletes with archive/deactivate.

Exit criteria: stable behavior with production-sized data and actionable monitoring for failures.

### Milestone 4: Quality and release gate

1. Repair lint and dependency versions.
2. Add unit, RLS, integration, and Playwright tests.
3. Add protected-branch CI.
4. Complete deployment/environment and legal documentation.

Exit criteria: typecheck, lint, tests, build, migration checks, and security policy all pass before merge.

## Definition Of Ready For The Next Feature Phase

Do not begin another large workflow until:

- all P0 items are closed;
- no visible control is inert;
- all static and generated links resolve;
- dashboard analytics are mathematically truthful;
- POSP/MISP applications can be securely approved;
- the service-role boundary is documented and tested;
- lists are paginated;
- lint, tests, and build run in CI;
- critical user journeys pass Playwright and RLS tests;
- production logging and error tracking are active.
