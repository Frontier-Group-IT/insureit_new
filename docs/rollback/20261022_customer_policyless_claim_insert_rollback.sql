-- Reverses only the additive policy from the forward migration.
begin;
drop policy if exists "customer_policyless_claim_draft_insert" on public.claims;
commit;
