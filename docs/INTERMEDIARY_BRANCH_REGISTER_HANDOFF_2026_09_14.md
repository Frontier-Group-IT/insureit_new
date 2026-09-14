# Intermediary Branch Register handoff — 2026-09-14

## State

**IMPLEMENTED on feature branch / NOT MERGED / NOT DEPLOYED**

Branch: `feature/intermediary-branch-register`

## User-visible change

- Adds a dedicated Branch Register at `/intermediaries/groups/branches`.
- Adds a `Branch Register` action beside `Add Branch` on the Business Groups page.
- Uses the existing register UI pattern with search, assignment views, Business Group filter, responsive table/cards and pagination.
- Shows the existing Branch record together with its parent Partner, inherited Business Group, assigned employee, Partner kind and status.
- Keeps `Add Branch` as the existing onboarding route and keeps hierarchy mutations in the existing protected Group/Branch actions.

## Data and access safety

- No new database table, migration, RPC or API contract is introduced.
- A Branch is identified only by the existing `partner_branch_profiles` record.
- Group is derived from the active membership of the root/parent Partner; a Branch does not receive its own Group membership.
- Employee visibility follows the existing intermediary Group employee scope, with the existing branch-created-by-viewer exception preserved.
- The page requires the existing Intermediary Group viewer access; `Add Branch` is shown only when the existing Group manager capability is available.

## Verification

Run the canonical `.github/workflows/verify-web-portal.yml` PR gate. Do not merge until explicitly approved by the user.
