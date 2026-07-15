# Technical Review: Group Workflow Step 2

Last reviewed: 2026-07-15
Branch reviewed: `main`
Current HEAD reviewed: `7374068 Merge pull request #66 from antnish1/revert-65-work-group-workflow-step-2`

## Current State Summary

`main` merged `work-group-workflow-step-2` in PR #65 and then reverted that PR in PR #66. The destructive mobile `Vehicles` and `Profile` replacements from commits `1181ba1` and `786ed84` are therefore no longer present at the branch tip.

Evidence:

- `1181ba1 Use selected customer context on vehicles screen` changed `apps/mobile-app/app/customer/vehicles.tsx` by `80 insertions` and `874 deletions`.
- `786ed84 Protect selected customer profile context` changed `apps/mobile-app/app/customer/profile.tsx` by `131 insertions` and `258 deletions`.
- `effa58e Revert "Work group workflow step 2"` restored large mobile files and removed the step-2 helper/actions.
- Current `apps/mobile-app/app/customer/vehicles.tsx` is back to a full-size implementation.
- Current `apps/mobile-app/lib/customer-context.ts` exists, but no current mobile screen imports it, so selected-account switching is not active in the mobile customer UI.

Important nuance: the step-2 branch was reverted, but earlier Group hierarchy work is still present. Some remaining web portal actions still write `customer_relationships` directly instead of using the canonical RPCs.

## A. Necessary Changes

These changes are necessary for the Group hierarchy workflow, but they should be implemented additively:

- Database support for active Group parent/child relationships:
  - `customer_relationships.status`
  - `effective_from`
  - `effective_to`
  - `approved_by`
  - `updated_at`
  - unique active Group parent per child
  - validation that parent is active `group`
  - validation that child is active `corporate`, `individual_proprietor`, or `dealership`

- Central database APIs:
  - `can_access_customer(customer_id)`
  - `get_accessible_customer_contexts()`
  - `link_customer_to_group(group_customer_id, child_customer_id)`
  - `unlink_customer_from_group(child_customer_id)`

- RLS and read access:
  - Group users must be able to read active child customers.
  - Child users must still read only their own direct account.
  - RLS should cover customers, vehicles, policies, claims, customer documents, claim documents, and support tickets.

- Mobile selected account:
  - one selected-account state source;
  - account switcher UI;
  - data loading scoped by selected customer;
  - no screen replacement or visual simplification.

- Portal Group management:
  - add/remove child customer relationships;
  - child onboarding forms can optionally attach to a Group;
  - edit pages can show or update Group affiliation;
  - all linking/unlinking should go through database RPCs.

## B. Unnecessary Removals

### Mobile Vehicles

Commit `1181ba1` unnecessarily replaced the full Vehicles screen with a much smaller selected-account implementation.

Removed or degraded behavior included:

- vehicle card layout and detailed styling;
- insurer/policy display;
- renewal and endorsement actions;
- document picking/upload flows;
- add-vehicle flows;
- modal and success states;
- helper formatting and richer empty states.

Status on current `main`: restored by PR #66. Do not reintroduce selected-account scoping by replacing this file again.

Restore needed: no, already restored on `main`.

### Mobile Profile

Commit `786ed84` unnecessarily reduced the Profile screen while trying to protect selected customer context.

Removed or degraded behavior included:

- profile UI sections;
- KYC/document management UI;
- document open/delete flows;
- settings and animation/styling surface.

Status on current `main`: restored by PR #66.

Restore needed: no, already restored on `main`.

### Mobile Home, Claims, Policies

The step-2 branch modified these screens for selected-account loading. Those changes were less destructive than Vehicles/Profile, but still mixed data scoping with UI edits.

Status on current `main`: reverted by PR #66.

Restore needed: no immediate restore. Reapply only the data-scope pieces later, keeping the existing UI intact.

### Web Individual and Dealership Onboarding

Commits `c6f031e`, `a4a88a6`, `842baf4`, and `4741216` showed large deletion counts while adding Group affiliation to existing forms/actions.

Risk:

- Group selector support may have been added by simplifying existing onboarding UI and action handling.
- These files should be compared against their pre-Group versions before any future merge.

Status on current `main`: step-2 versions were reverted, but earlier Group changes still exist for Corporate onboarding and edit.

## C. Unsafe Changes

### Direct Relationship Writes Bypass Canonical RPCs

Current files still write to `customer_relationships` directly:

- `apps/web-portal/app/customers/groups/[id]/members/actions.ts`
  - `addGroupMember` uses direct `upsert`.
  - `removeGroupMember` hard-deletes relationship rows.
- `apps/web-portal/app/customers/corporate-actions.ts`
  - corporate creation inserts a `group_member` row directly.
- `apps/web-portal/app/customers/[id]/edit/corporate-actions.ts`
  - corporate edit ends relationships and upserts a new row directly.

Why unsafe:

- It duplicates business rules outside the database.
- It can diverge from `link_customer_to_group` and `unlink_customer_from_group`.
- Hard-delete violates the requirement to preserve historical relationships.
- Multiple app actions can race unless the database owns the transition.

Recommendation:

- Replace direct relationship `insert`, `upsert`, `update`, and `delete` calls with `link_customer_to_group` and `unlink_customer_from_group`.
- `removeGroupMember` must end the relationship, not delete it.

### Incomplete Recovery Migration

`supabase/migrations/202607150006_group_customer_hierarchy_access.sql` contains the full intended foundation, including:

- indexes;
- validation trigger;
- `can_access_customer`;
- RLS policies;
- `get_accessible_customer_contexts`;
- link/unlink RPCs.

`supabase/migrations/202607150007_fix_group_context_union_order.sql` is self-contained only for columns, status check, and `get_accessible_customer_contexts`.

Risk:

- If `202607150006` failed and only `202607150007` ran, the database may still be missing indexes, validation trigger, `can_access_customer`, RLS policies, and link/unlink RPCs.

Recommendation:

- Add one idempotent repair migration that recreates every object from `202607150006`, with the corrected `get_accessible_customer_contexts` query from `202607150007`.
- Verify it against the live Supabase project before relying on mobile Group access.

### Partial Rollback Behavior

`apps/web-portal/app/customers/corporate-actions.ts` creates the customer first, then links Group, inserts contacts, memberships, permanent contacts, uploads files, writes document records, and finally approves onboarding.

Risk:

- Cleanup mainly deletes the customer and uploaded files.
- If later steps fail, related rows may be left behind depending on foreign-key cascade behavior.
- Auth/profile side effects are not clearly rolled back.

Recommendation:

- Move multi-step creation into a database RPC/transaction where possible.
- If application-side cleanup remains, explicitly remove onboarding contacts, memberships, contacts, documents, storage files, relationships, and application state.

### Mobile Selected Account Helper Is Orphaned

`apps/mobile-app/lib/customer-context.ts` defines the selected-account helper and uses `get_accessible_customer_contexts`, but current mobile screens do not import it.

Risk:

- The database function may exist but the mobile app does not currently use selected customer scoping.
- Future work could accidentally reintroduce broad screen rewrites.

Recommendation:

- Introduce a small reusable account switcher and hook.
- Use it in existing screens by changing only query filters and identity labels.

## D. UI/UX Regression List

### Mobile Home

Regression risk in step-2 branch:

- dashboard content was reduced while selected-account support was added.

Current `main`:

- reverted to pre-step-2 state.

Future implementation:

- keep existing dashboard cards, KYC states, quick actions, and bottom navigation;
- scope dashboard queries by selected customer only.

### Vehicles

Regression confirmed in `1181ba1`:

- full screen replaced with a compact implementation;
- large UI and interaction loss.

Current `main`:

- restored.

Future implementation:

- preserve all vehicle cards, modals, document flows, renewal/endorsement actions, add-vehicle actions, and styling;
- change data loading to the selected customer.

### Policies

Regression risk:

- selected-account support was mixed into screen code.

Current `main`:

- reverted.

Future implementation:

- filter policies by selected customer without changing presentation.

### Claims

Regression risk:

- selected-account support was mixed into screen code.

Current `main`:

- reverted.

Future implementation:

- filter claims by selected customer without changing cards, statuses, or navigation.

### Profile

Regression confirmed in `786ed84`:

- profile UI and document-management functionality were reduced.

Current `main`:

- restored.

Future implementation:

- show signed-in person identity separately from selected customer account identity;
- do not remove profile, KYC, settings, or document flows.

### Corporate Onboarding

Current Group support exists in:

- `apps/web-portal/app/customers/corporate-onboarding-form.tsx`
- `apps/web-portal/app/customers/corporate-actions.ts`
- `apps/web-portal/app/customers/new/page.tsx`

Risk:

- relationship write is direct;
- creation flow is not fully transactional.

### Individual and Dealership Onboarding

Step-2 branch added Group support but with large deletions in forms/actions.

Current `main`:

- step-2 versions reverted.

Future implementation:

- re-add selector with minimal form changes;
- preserve validation, uploads, success/error states, and layout.

### Group Profile and Member Management

Current `apps/web-portal/app/customers/groups/[id]/members/page.tsx` provides a basic management page.

Issues:

- source contains mojibake in option labels (`Â·`);
- remove action hard-deletes relationship rows;
- add action writes relationship rows directly.

Future implementation:

- use existing portal design patterns;
- call link/unlink RPCs;
- preserve historical relationships.

## E. Correct Implementation Plan

1. Add an idempotent database repair migration.
   - Recreate missing indexes, triggers, RLS policies, `can_access_customer`, `get_accessible_customer_contexts`, `link_customer_to_group`, and `unlink_customer_from_group`.
   - Use the corrected union/order query from `202607150007`.

2. Replace portal direct relationship mutations with RPC calls.
   - Update Group member add/remove actions.
   - Update Corporate onboarding Group link.
   - Update Corporate edit Group affiliation.
   - Add Individual/Dealership support only after the RPC path is stable.

3. Fix Group member UI text.
   - Replace mojibake separators with clean ASCII or proper entities.
   - Keep the page visually consistent with the portal shell.

4. Reintroduce selected account on mobile through a reusable layer.
   - Create a small selected-account hook/provider.
   - Create a compact account switcher component.
   - Use `apps/mobile-app/lib/customer-context.ts` or fold it into the new provider.

5. Apply mobile data scoping one screen at a time.
   - Home: selected customer metrics only.
   - Vehicles: selected customer vehicles only.
   - Policies: selected customer policies only.
   - Claims: selected customer claims only.
   - Profile: signed-in user identity and selected account identity shown separately.

6. Preserve UI while changing queries.
   - Do not replace full screens.
   - Do not remove modals, upload flows, cards, animations, empty states, or styling.
   - Review diffs for deletion spikes before merge.

7. Add verification.
   - `npm run typecheck:mobile`
   - `npm run typecheck:web`
   - `npm run build:web`
   - manual mobile regression checks for direct customer, Group user, and child customer user.

## Recommended Next Work

Highest-value next fix:

1. Create the idempotent hierarchy repair migration.
2. Change `apps/web-portal/app/customers/groups/[id]/members/actions.ts` to use `link_customer_to_group` and `unlink_customer_from_group`.
3. Fix the hard-delete relationship behavior.
4. Run web typecheck/build.
5. Then reintroduce mobile selected-account support without touching the restored Vehicles/Profile UI.
