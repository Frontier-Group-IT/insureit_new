# Partner customer filter schema release gate — 2026-09-16

## State

The Partner Customer Portfolio filter implementation was merged in PR #1943 at `45b395912d39257790f8b1fb8884fc00fb86b88f` after canonical web verification, but its first production deployment run was blocked before Vercel because migration `20260916154500_partner_web_customer_filters.sql` did not yet have a dedicated automated schema application workflow.

## Release repair

`apply-partner-customer-filters.yml` is the dedicated production schema workflow for migration `20260916154500`.

It:

- runs only on `main` when the migration or this workflow changes, or by explicit workflow dispatch;
- requires the configured production Supabase project variables/secrets;
- applies only `supabase/migrations/20260916154500_partner_web_customer_filters.sql`;
- records migration version `20260916154500` as applied;
- verifies `public.partner_app_list_customers_filtered(integer,integer,text,text,text)` exists;
- verifies the `authenticated` role has `EXECUTE` on the RPC.

The migration is additive and reversible. Its matching rollback remains at `supabase/rollbacks/20260916154500_partner_web_customer_filters.sql`.

## Evidence boundary

Adding this workflow is **IMPLEMENTED**, not proof that the migration is applied or the portal is deployed. Those states require successful workflow and Vercel evidence for the merged release.
