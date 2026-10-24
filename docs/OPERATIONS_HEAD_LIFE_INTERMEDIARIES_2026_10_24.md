# Operations Head – Life: Intermediary menu and downline-only Add/Edit

Date: 24 October 2026

## Requested behavior
- Enable Intermediary register and relevant Partner/POSP/MISP list/detail and onboarding pages for role `operations_head_life`.
- Add intermediary applications only for Gagan Singh (employee code 5117, UUID `ac167429-0ce0-4ffe-90ea-4040cb4fea95`) or members of his active recursive reporting downline.
- Edit intermediary primary information only for records tied to this reporting tree; new RM assignment must stay within the same reporting tree.
- Block editing or absorbing outside-downline partners, including existing-PAN application reuse.
- Do not grant unrelated full onboarding review/approval, activation, permanent deletion, login account management, agreement/IIB/training control, bulk imports, or global intermediary data.

## Implementation
- `lib/roles.ts`: add `view_intermediaries` only, without generic create/review/approve capabilities. Dedicated authorized handlers handle Add/Edit to avoid unlocking all manager workflows.
- `lib/permission-management.ts`: ceiling explicitly allows `view_intermediaries=view`, all unrelated intermediary capabilities remain denied.
- `lib/employee-access-scope.ts`: include `view_intermediaries` in Gagan’s existing fail-closed recursive hierarchy resolver. Include matching application links from onboarding and intermediary records. Unlinked/unassigned intermediaries remain inaccessible.
- `lib/master-data-server.ts`: only explicit opt-in manager getters allow this role. The scoped getter independently checks the application’s relationship with Gagan’s downline. General manager actions remain denied.
- Registers, POSP/MISP forms, and application primary-edit UI use those explicit opt-in getters. Dropdowns show only in-scope employees.
- `manual-actions-v2.ts` and legacy create entry: independently validate selected associate employee on the server, including direct server-action invocation.
- `intermediary-edit-actions.ts`: validates both existing application ownership and proposed new associate; limits to primary details, prevents legacy migration/document/approval actions, synchronizes linked intermediary association fields and records actor/time.
- Existing PAN collision in the new submit route: do not redirect to an out-of-scope existing application.
- `middleware.ts`: only explicitly allowed intermediary routes for this role. The middleware is not considered data security.
- New regression checks wired into PR verification.

## QA and rollout criteria
1. Role sees only Gagan/downline intermediaries and related applications. Other logins unchanged.
2. New POSP and MISP form lists only allowed associates; malicious posted employee IDs outside downline fail server-side.
3. Existing outside-team intermediary by direct URL or action rejects with access denied.
4. Existing within-team intermediary can edit primary details; assignment outside downline fails even if posted directly.
5. No activation, delete, privileged associate-accounts, approval, training/IIB or global import permission.
6. Check CI regression, TypeScript, lint, production build, existing access-control tests.
7. Merge only when green. Do not automatically deploy or assign employees.
