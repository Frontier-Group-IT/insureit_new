-- Resolve only the signed-in branch contact for the Partner welcome greeting.
-- Never expose other branches' contact names.
create or replace function public.partner_web_current_branch_contact_name()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select nullif(btrim(bp.contact_name), '')
  from public.partner_portal_access_context() c
  join public.partner_branch_profiles bp
    on bp.partner_id = c.entity_id
  where auth.uid() is not null
    and c.account_type = 'branch'
  limit 1;
$$;

revoke all on function public.partner_web_current_branch_contact_name() from public, anon;
grant execute on function public.partner_web_current_branch_contact_name() to authenticated;
