begin;
-- Roll back schema extension only when no non-admin roles exist.
do $$ begin
 if exists(select 1 from public.group_portal_associate_accounts where role <> 'group_admin') then
  raise exception 'Cannot remove additional Group roles while assigned accounts exist';
 end if;
 if exists(select 1 from public.group_administrator_contacts) then
  raise exception 'Cannot remove Group administrator contacts while saved records exist';
 end if;
end $$;
alter table public.group_portal_associate_accounts drop constraint group_portal_associate_accounts_role_check;
alter table public.group_portal_associate_accounts add constraint group_portal_associate_accounts_role_check check (role='group_admin');
drop table public.group_administrator_contacts;
-- Restore previous Group Associate identity output (administrator-only contract).
create or replace function public.partner_app_current_identity()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $
declare v_group uuid; v_code text; v_name text; v_email text; v_name_person text;
begin
 v_group:=public.group_associate_active_group_id();
 if v_group is not null then
  select group_code,group_name into v_code,v_name from public.intermediary_groups where id=v_group;
  select email,name into v_email,v_name_person from public.group_portal_associate_accounts where auth_user_id=auth.uid();
  return jsonb_build_object('actor_kind','intermediary','auth_user_id',auth.uid(),'profile_id',auth.uid(),
   'portal_account_id',null,'intermediary_id',null,'intermediary_type','group',
   'intermediary_code',v_code,'display_name',v_name,'partner_id',null,'partner_code',null,
   'partner_name',v_name,'portal_access_type','group','portal_access_entity_id',v_group,
   'group_id',v_group,'group_code',v_code,'group_name',v_name,'login_email',v_email,
   'account_subtype','group_associate','associate_name',v_name_person,'associate_role','group_admin');
 end if;
 return public.partner_app_current_identity_before_group_associates();
end;
$;
revoke all on function public.partner_app_current_identity() from public,anon;
grant execute on function public.partner_app_current_identity() to authenticated,service_role;
commit;