-- Production follow-up for the Intermediary Group foundation.
--
-- 1. Lock trigger-only SECURITY DEFINER helpers out of exposed RPC roles.
--    These functions execute only through database triggers; client roles must never
--    be able to invoke their bodies through PostgREST RPC.
-- 2. Add covering indexes for the new audit foreign keys so the Group foundation
--    does not introduce avoidable foreign-key performance lint.

revoke all on function public.close_group_membership_on_partner_owner_change() from public, anon, authenticated;
revoke all on function public.validate_intermediary_group_membership() from public, anon, authenticated;

create index if not exists intermediary_groups_created_by_idx
  on public.intermediary_groups(created_by);
create index if not exists intermediary_groups_updated_by_idx
  on public.intermediary_groups(updated_by);
create index if not exists intermediary_groups_archived_by_idx
  on public.intermediary_groups(archived_by);
create index if not exists intermediary_group_memberships_assigned_by_idx
  on public.intermediary_group_memberships(assigned_by);
create index if not exists intermediary_group_memberships_removed_by_idx
  on public.intermediary_group_memberships(removed_by);
