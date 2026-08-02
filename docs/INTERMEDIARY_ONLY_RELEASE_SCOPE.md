# INSUREIT Intermediary-Only Production Release Scope

> **Decision date:** 2026-08-03 (IST)
>
> The first production release is intentionally limited to the Intermediary workspace. Customer, fleet, policy, claim, task, report and general administration workspaces remain in the repository but are outside the approved launch scope.

## 1. Launch mode

Production must set:

```text
NEXT_PUBLIC_INSUREIT_LAUNCH_SCOPE=intermediary
```

This mode:

- Sends authenticated internal users to `/intermediaries` instead of `/dashboard`.
- Shows only the Intermediary workspace in desktop and mobile navigation.
- Provides Intermediary-focused mobile quick links.
- Hides Dashboard, Claims, Customers & Fleet, Tasks, Reports, Settings, Notifications and Development navigation.
- Redirects authenticated internal users away from unfinished protected modules.
- Keeps external intermediary users inside `/intermediary-portal`.
- Preserves the hidden source code so other modules can be completed later without destructive removal.

## 2. Routes included in the first production release

### Internal operations

- `/intermediaries`
- `/intermediaries/partner`
- `/intermediaries/posp`
- `/intermediaries/misp`
- `/intermediaries/portal-users`
- `/intermediaries/applications/[id]`
- `/intermediaries/applications/[id]/workflow`
- `/customers/posp-misp`
- `/customers/posp-misp/new`
- `/customers/posp-misp/import`
- `/customers/posp-misp/import/batches`

### External intermediary portal

- `/intermediary-portal`
- Required invitation, authentication and password-recovery routes.

### Required server/API operations

Only API routes and Server Actions used by the included Intermediary journeys are in scope, including:

- Intermediary document upload/finalization/read operations
- Partner, POSP and MISP onboarding actions
- Portal user invite/resend actions
- PAN/IIB preparation actions
- iCall registration, status and SSO actions when the integration is enabled

Each route/action remains responsible for its own capability and record-scope checks. Navigation hiding is not authorization.

## 3. Routes excluded from the first production release

When Intermediary-only mode is enabled, internal users are redirected away from:

- `/dashboard`
- General `/customers` routes outside `/customers/posp-misp`
- `/customer-kyc`
- `/vehicles`
- `/policies`
- `/claims`
- `/claim-documents`
- `/documents`
- `/timeline`
- `/tasks`
- `/reports`
- `/organization`
- `/employees`
- `/users`
- `/notifications`
- `/settings`
- `/customers/posp-misp/icall-uat`

These modules are not approved merely because their source remains in the repository.

## 4. Intermediary release blockers

The scoped launch remains **NO-GO** until all of the following have direct evidence:

1. The atomic Partner activation migration is applied in the target Supabase project:
   - `supabase/migrations/20260802172500_finalize_partner_activation_atomically.sql`
2. Partner document finalization successfully creates or preserves the permanent Partner ID and rolls back forced failures.
3. Individual Partner creates only one linked POSP; Business Partner creates only one linked MISP.
4. Legacy Partner and POSP/MISP IDs remain unchanged.
5. Full Aadhaar and encrypted Aadhaar ciphertext are absent from browser payloads and client state.
6. Every Intermediary page, API route, Server Action, document operation and integration action enforces capability plus record scope.
7. The account deletion migration is applied and child-only/parent-with-children deletion is tested in staging.
8. iCall status synchronization cannot regress agreement, IIB or registered states.
9. Required document storage is private and signed URLs are short-lived and scoped.
10. TypeScript, production build and the Intermediary authorization/UAT matrix pass for the exact release SHA.
11. Vercel environment variables include the Intermediary launch flag and required Supabase/iCall server secrets.
12. The exact deployment reaches Vercel `Ready`, followed by authenticated smoke tests and rollback readiness.

## 5. Current Partner activation incident

The reported Partner application:

```text
8d04c610-4bec-4ce8-9aa4-f5e2388d626b
```

returned the safe atomic failure message:

```text
Partner activation could not be completed. No partial activation was retained.
```

The web route calls `finalize_partner_activation_v2`. The most likely first check is whether the required migration/function exists in the target Supabase database. Run:

```text
supabase/verification/20260803_partner_activation_runtime_diagnostic.sql
```

This script is read-only and checks function availability, service-role permission, application state, required documents, relevant constraints and existing Partner links.

Do not restore the old multi-step activation fallback. A missing migration must be applied and verified rather than bypassing atomicity.

## 6. Release evidence required

For the exact release commit, retain:

- TypeScript and production build output
- Supabase migration history/export
- Runtime diagnostic results
- Partner creation and retry test results
- New and legacy Partner/POSP/MISP UAT record IDs
- Cross-scope denial results
- Browser network capture proving Aadhaar minimization
- Storage signed-URL tests
- iCall vendor confirmation and session test when included
- Vercel deployment status and smoke-test report
- Previous known-good deployment and rollback procedure

## 7. Scope-change rule

Adding another product module to production requires an explicit scope decision, its own security/workflow review, and updated release evidence. The Intermediary-only flag must not be removed merely to expose unfinished navigation.
