begin;
-- Separate, multiple group associate identities; primary portal_access_identities remains unchanged.
create table public.group_portal_associate_accounts (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.intermediary_groups(id) on delete restrict,
 auth_user_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null, phone_number text not null, email text not null,
 designation text not null, address text, city text, state text, postal_code text,
 role text not null default 'group_admin' check (role='group_admin'),
 status text not null default 'invited' check(status in ('invited','active','disabled')),
 invited_at timestamptz, activated_at timestamptz, disabled_at timestamptz,
 created_by uuid references public.profiles(id) on delete set null,
 updated_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index group_portal_associates_email_unique on public.group_portal_associate_accounts(lower(email));
create index group_portal_associates_group_idx on public.group_portal_associate_accounts(group_id,created_at desc);
alter table public.group_portal_associate_accounts enable row level security;
revoke all on public.group_portal_associate_accounts from public,anon,authenticated;
grant select,insert,update,delete on public.group_portal_associate_accounts to service_role;
create table public.group_portal_associate_audit(
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.intermediary_groups(id) on delete restrict,
 associate_id uuid references public.group_portal_associate_accounts(id) on delete set null,
 actor_id uuid references public.profiles(id) on delete set null,
 event_type text not null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.group_portal_associate_audit enable row level security;
revoke all on public.group_portal_associate_audit from public,anon,authenticated;
grant select,insert on public.group_portal_associate_audit to service_role;

-- Provide group access context for associates without loosening the unique primary Group login.
-- This is resolved from the signed-in user's auth.uid(), never user-supplied group IDs.
create or replace function public.group_associate_active_group_id()
returns uuid language sql stable security definer set search_path=public,auth as $$
 select a.group_id from public.group_portal_associate_accounts a
 join public.profiles p on p.id=a.auth_user_id and p.is_active=true
 join public.intermediary_groups g on g.id=a.group_id and g.status='active'
 where a.auth_user_id=auth.uid() and a.status='active' limit 1;
$$;
revoke all on function public.group_associate_active_group_id() from public,anon;
grant execute on function public.group_associate_active_group_id() to authenticated,service_role;

-- Wrap the existing, potentially newer identity implementation without overwriting its body.
alter function public.partner_app_current_identity() rename to partner_app_current_identity_before_group_associates;
create function public.partner_app_current_identity()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
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
$$;
revoke all on function public.partner_app_current_identity_before_group_associates() from public,anon,authenticated;
grant execute on function public.partner_app_current_identity_before_group_associates() to service_role;
revoke all on function public.partner_app_current_identity() from public,anon;
grant execute on function public.partner_app_current_identity() to authenticated,service_role;

-- A separate branch of access_context for associate identities uses the same active
-- membership traversal as the original Group login, preventing cross-Group escalation.
alter function public.partner_portal_access_context() rename to partner_portal_access_context_before_group_associates;
create function public.partner_portal_access_context()
returns table(account_type text,entity_id uuid,login_email text,scoped_partner_ids uuid[])
language plpgsql stable security definer set search_path=public,auth as $$
declare v_group uuid; v_email text;
begin
 v_group:=public.group_associate_active_group_id();
 if v_group is not null then
   select a.email into v_email from public.group_portal_associate_accounts a where a.auth_user_id=auth.uid();
   return query
    with member_partners as (
      select distinct m.partner_id from public.intermediary_group_memberships m
      join public.partners p on p.id=m.partner_id and p.partner_status='active_partner'
      where m.group_id=v_group and m.effective_to is null
    ), scoped as (
      select mp.partner_id id from member_partners mp
      union
      select p.id from public.partners p
      join public.partner_branch_profiles b on b.partner_id=p.id
      join member_partners mp on mp.partner_id=p.parent_partner_id
      where p.partner_status='active_partner'
    )
    select 'group'::text,v_group,v_email,
      coalesce(array_agg(distinct scoped.id) filter(where scoped.id is not null),'{}'::uuid[]) from scoped;
   return;
 end if;
 return query select c.account_type,c.entity_id,c.login_email,c.scoped_partner_ids
   from public.partner_portal_access_context_before_group_associates() c;
end;
$$;
revoke all on function public.partner_portal_access_context_before_group_associates() from public,anon,authenticated;
grant execute on function public.partner_portal_access_context_before_group_associates() to service_role;
revoke all on function public.partner_portal_access_context() from public,anon;
grant execute on function public.partner_portal_access_context() to authenticated,service_role;
-- Ensure the canonical activation entrypoint recognizes invited Group associates.
alter function public.partner_app_activate_current_account() rename to partner_app_activate_current_account_before_group_associates;
create function public.partner_app_activate_current_account()
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare v_account public.group_portal_associate_accounts%rowtype; v_now timestamptz:=now();
begin
 select * into v_account from public.group_portal_associate_accounts where auth_user_id=auth.uid() for update;
 if found then
  if v_account.status='disabled' then
   raise exception 'Group associate account disabled' using errcode='28000';
  end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active=true) then
   raise exception 'Group associate profile inactive' using errcode='28000';
  end if;
  if not exists(select 1 from public.intermediary_groups where id=v_account.group_id and status='active') then
   raise exception 'Business Group inactive' using errcode='28000';
  end if;
  if v_account.status='invited' then
   update public.group_portal_associate_accounts set status='active',activated_at=coalesce(activated_at,v_now),updated_at=v_now where id=v_account.id;
   insert into public.group_portal_associate_audit(group_id,associate_id,actor_id,event_type)
   values(v_account.group_id,v_account.id,auth.uid(),'activated');
  end if;
  return public.partner_app_current_identity();
 end if;
 return public.partner_app_activate_current_account_before_group_associates();
end;
$$;
revoke all on function public.partner_app_activate_current_account_before_group_associates() from public,anon,authenticated;
grant execute on function public.partner_app_activate_current_account_before_group_associates() to service_role;
revoke all on function public.partner_app_activate_current_account() from public,anon;
grant execute on function public.partner_app_activate_current_account() to authenticated,service_role;

-- Retarget SQL-language convenience functions at the new wrapper functions.
create or replace function public.partner_portal_current_identity()
returns jsonb language sql stable security definer set search_path=public,auth as $$
 select public.partner_app_current_identity();
$$;
revoke all on function public.partner_portal_current_identity() from public,anon;
grant execute on function public.partner_portal_current_identity() to authenticated,service_role;

create or replace function public.partner_portal_scoped_partner_ids()
returns uuid[] language sql stable security definer set search_path=public as $$
 select coalesce((select c.scoped_partner_ids from public.partner_portal_access_context() c limit 1),'{}'::uuid[]);
$$;
revoke all on function public.partner_portal_scoped_partner_ids() from public,anon;
grant execute on function public.partner_portal_scoped_partner_ids() to authenticated,service_role;
commit;
