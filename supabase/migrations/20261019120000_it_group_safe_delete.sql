-- Atomic removal of an unlinked Intermediary Group, invoked only using
-- a service-role server action that independently verifies IT Super User.
create or replace function public.it_delete_unlinked_intermediary_group(p_group_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_exists boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorized to delete groups' using errcode = '42501';
  end if;
  select exists(select 1 from public.intermediary_groups where id=p_group_id)
    into v_exists;
  if not v_exists then return false; end if;

  -- Never cascade partner/member/business records or detach policy history.
  if exists(select 1 from public.intermediary_group_memberships where group_id=p_group_id)
    or exists(select 1 from public.group_portal_associate_accounts where group_id=p_group_id)
    or exists(select 1 from public.group_portal_associate_audit where group_id=p_group_id)
    or exists(select 1 from public.partner_scheme_assignments where group_id=p_group_id)
    or exists(select 1 from public.policies where intermediary_group_id=p_group_id)
    or exists(select 1 from public.portal_access_identities where entity_type='group' and entity_id=p_group_id)
  then
    raise exception 'Group has linked members, accounts, audit records, schemes, policies or login identities. Remove links safely before deleting.'
      using errcode = '23503';
  end if;

  delete from public.group_administrator_contacts where group_id=p_group_id;
  delete from public.intermediary_groups where id=p_group_id;
  return true;
end;
$$;
revoke all on function public.it_delete_unlinked_intermediary_group(uuid) from public, anon, authenticated;
grant execute on function public.it_delete_unlinked_intermediary_group(uuid) to service_role;
