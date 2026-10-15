begin;
-- Additive contact metadata for the primary Group administrator.
-- Existing Group identities and memberships are never rewritten.
create table if not exists public.group_administrator_contacts(
 group_id uuid primary key references public.intermediary_groups(id) on delete restrict,
 profile_id uuid not null references public.profiles(id) on delete restrict,
 admin_name text not null,
 admin_email text not null,
 admin_mobile text not null,
 address text not null,
 city text not null,
 state text not null,
 postal_code text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null
);
alter table public.group_administrator_contacts enable row level security;
revoke all on public.group_administrator_contacts from public,anon,authenticated;
grant select,insert,update on public.group_administrator_contacts to service_role;
-- Preserve existing Group Administrator records; add scoped associate role options.
alter table public.group_portal_associate_accounts drop constraint if exists group_portal_associate_accounts_role_check;
alter table public.group_portal_associate_accounts
 add constraint group_portal_associate_accounts_role_check
 check (role in ('group_admin','insurance_head','claim_head','bodyshop_manager'));
-- Preserve the existing Partner identity resolver; only correct Group Associate role metadata.
create or replace function public.partner_app_current_identity()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $
declare v_group uuid; v_code text; v_name text; v_email text; v_name_person text; v_role text;
begin
 v_group:=public.group_associate_active_group_id();
 if v_group is not null then
  select group_code,group_name into v_code,v_name from public.intermediary_groups where id=v_group;
  select email,name,role into v_email,v_name_person,v_role
   from public.group_portal_associate_accounts where auth_user_id=auth.uid();
  return jsonb_build_object('actor_kind','intermediary','auth_user_id',auth.uid(),'profile_id',auth.uid(),
   'portal_account_id',null,'intermediary_id',null,'intermediary_type','group',
   'intermediary_code',v_code,'display_name',v_name,'partner_id',null,'partner_code',null,
   'partner_name',v_name,'portal_access_type','group','portal_access_entity_id',v_group,
   'group_id',v_group,'group_code',v_code,'group_name',v_name,'login_email',v_email,
   'account_subtype','group_associate','associate_name',v_name_person,'associate_role',v_role);
 end if;
 return public.partner_app_current_identity_before_group_associates();
end;
$;
revoke all on function public.partner_app_current_identity() from public,anon;
grant execute on function public.partner_app_current_identity() to authenticated,service_role;
commit;