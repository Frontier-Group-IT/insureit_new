# INSUREIT Partner — Intermediary Group Architecture Handoff

> Last updated: 2026-08-26 IST
>
> This handoff records the commercial hierarchy that must exist before the separate **INSUREIT Partner** mobile app is built. Treat these rules as durable product and backend invariants.

## Product objective

INSUREIT Partner is a separate mobile application for Partners, POSP, MISP, Relationship Managers, Sales Heads and other authorized sales employees. It will share the production Supabase backend, permission model, commercial attribution and customer/policy records with the web portal. It is not the existing customer mobile app and it is not the Operations mobile app.

The Intermediary Group layer is being implemented first so the app does not need a hierarchy rewrite after launch.

## Canonical hierarchy

The commercial hierarchy is:

`Sales Employee → optional Intermediary Group → permanent Partner family → linked POSP/MISP`

An ungrouped Partner family remains directly under its sales employee:

`Sales Employee → permanent Partner family → linked POSP/MISP`

Example:

- RM A → Group X → Partner families 1, 2, 3
- RM A → ungrouped Partner families 4, 5

## Permanent Partner-family rule

Grouping attaches to the permanent `partners.id` family, never independently to the linked POSP or MISP registration. Therefore:

- Partner and linked POSP/MISP always inherit the same Group.
- A linked qualification account must not be counted as a second Group member.
- Changing Group membership moves the commercial Partner family, not the qualification registration separately.

## Ownership rule

`intermediaries.associate_employee_id` remains the current sales owner. Intermediary Groups do not replace that ownership field and are not login roles.

An active Group is owned by one employee. Every active Partner-family membership in that Group must have the same current sales employee owner.

If Partner ownership changes outside a whole-Group transfer, the active Group membership is automatically closed so stale Group ownership cannot survive the employee transfer.

## Effective-dated membership

`intermediary_group_memberships` is historical/effective-dated:

- one active membership maximum per permanent Partner family;
- `effective_from` marks entry into a Group;
- `effective_to` closes the relationship;
- moving or ungrouping a Partner closes the prior row instead of rewriting history;
- the virtual `Ungrouped` bucket is not stored as a database Group.

## Whole-Group transfer

A privileged hierarchy manager may transfer an entire Group to another permitted employee. The transfer moves the Group and its active Partner families together and synchronizes the current sales-owner references for the relevant Partner/POSP/MISP records.

Relationship Managers may manage Groups within their permitted scope but are not allowed to perform whole-Group ownership transfers.

## Permission and scope rule

Group reads use `view_intermediaries` scope.

Group mutations must satisfy both:

1. the target employee is inside the user's `view_intermediaries` scope; and
2. the target employee is inside at least one mutation capability scope that actually grants edit access (`create_intermediary_application` or `review_intermediary_application`).

This prevents a broad read scope from becoming an unintended broad mutation scope when service-role server actions execute the database writes.

## Policy attribution

Policies receive optional historical Group snapshot fields:

- `intermediary_group_id`
- `intermediary_group_code`
- `intermediary_group_name`

The snapshot is resolved from the policy source Partner family at booking time. If the source intermediary is corrected later, the Group is re-resolved at correction time. Editing only the policy issuance date does not rewrite historical Group attribution.

Existing policies are deliberately not backfilled by the Group migration.

## Database objects

Planned migrations in PR #677:

- `20260826235920_intermediary_group_foundation.sql`
- `20260826235930_intermediary_group_integrity_hardening.sql`
- `20260826235940_intermediary_group_review_hardening.sql`

Primary objects:

- `public.intermediary_groups`
- `public.intermediary_group_memberships`
- service-only Group mutation RPCs
- Partner-owner consistency triggers
- policy Group snapshot trigger/function

Group tables and mutation RPCs are server-mediated in V1. `anon` and `authenticated` must not receive direct Group mutation access.

## Web portal management surface

The first authoritative management workspace is `/intermediaries/groups`.

It presents:

`Employee → Group → Partner family`

with a virtual `Ungrouped` bucket. The existing Partner Register also provides a Groups entry point. The workspace must respect the same employee hierarchy and effective permissions as the rest of the portal.

## INSUREIT Partner dependency

Do not begin role-specific INSUREIT Partner business workflows until this hierarchy has been merged, migrated and production-verified.

The future app will use the same hierarchy for:

- Partner/POSP/MISP `My Business` scope;
- RM portfolio scope;
- Sales Head team/downline scope;
- Customers and policies visible through those commercial relationships;
- renewals and policy-intake business views;
- business reporting and drill-down.

The app must not create a second Group model, second Partner ownership model, or mobile-only permission logic.

## Rollout status

**VERIFIED / APPLIED 2026-08-26:** the Intermediary Group foundation and subsequent hardening migrations are applied to production Supabase. The web management surface is live, the Group lifecycle was rollback-tested against real production relationship IDs, and Group-specific trigger/mutation ACL hardening was verified.

Production currently supports optional Groups while leaving ungrouped permanent Partner families directly under their Sales Employee. Existing policies were intentionally not backfilled into Group snapshot fields.

The backend prerequisite for INSUREIT Partner has therefore been crossed. Continue with `docs/INSUREIT_PARTNER_APP_ARCHITECTURE.md` for the Partner-app identity, portal-account and commercial-scope contract. Do not auto-create real business Groups or intermediary portal accounts without an explicit business/UAT decision.


## Relationship Board visual redesign — 2026-08-29

**IMPLEMENTED IN FEATURE BRANCH, NOT YET MERGED:** `ui/intermediary-groups-relationship-board-v2` redesigns `/intermediaries/groups` as the approved INSUREIT visual-first Relationship Board without changing the hierarchy model or mutation rules.

The redesign keeps the canonical hierarchy and existing server actions intact while improving the management surface with:

- a visual header and semantic KPI cards for Partners, Groups, Grouped and Ungrouped Partner families;
- a stronger search/filter toolbar with Board/List view controls and reset action;
- employee cards with visual portfolio status chips;
- a two-zone employee workspace: amber **Ungrouped Partners** attention area and violet **Partner Groups** area;
- compact Partner identity cards that retain selection, drag/move and ungroup actions;
- a global sticky selection action bar for creating a Group from selected Partner families or moving them into an existing Group;
- empty-success states when an employee has no ungrouped Partner families;
- the existing create-group modal, manage-group drawer, transfer, archive, drag/drop and effective-dated membership actions remain authoritative and unchanged.

No database migration or hierarchy/business-rule change is part of this UI redesign.


## Relationship Board usability fixes — 2026-08-29

**IMPLEMENTED IN FEATURE BRANCH, NOT YET MERGED:** `fix/intermediary-group-selection-ux` refines the visual Relationship Board after production review.

- Sales Employee filter is widened so full employee names/codes are readable in the native dropdown.
- An empty **Partner Groups** panel now includes an in-context **Create new group** action for that employee.
- Selecting Partner families now surfaces the bulk action bar directly below the Relationship Board heading as a sticky, highly visible action area instead of only at the bottom of the viewport.
- The create modal now distinguishes between an employee-level Group creation and **Create Group from selected**, so employee-context creation does not show misleading “selected” text when no Partner is selected.

No hierarchy, database, permission or mutation-rule change is included.
