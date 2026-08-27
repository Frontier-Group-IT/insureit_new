begin;

create table if not exists public.intermediary_portal_account_audit (
  id uuid primary key default gen_random_uuid(),
  portal_account_id uuid references public.intermediary_portal_accounts(id) on delete set null,
  intermediary_id uuid not null references public.intermediaries(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('invited','invite_resent','activated','disabled')),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.intermediary_portal_account_audit enable row level security;
revoke all on table public.intermediary_portal_account_audit from public, anon, authenticated;
grant select, insert on table public.intermediary_portal_account_audit to service_role;

create index if not exists intermediary_portal_account_audit_intermediary_idx
  on public.intermediary_portal_account_audit(intermediary_id, created_at desc);
create index if not exists intermediary_portal_account_audit_account_idx
  on public.intermediary_portal_account_audit(portal_account_id, created_at desc);

create or replace function public.partner_app_activate_current_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.intermediary_portal_accounts%rowtype;
  v_partner_id uuid;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  select * into v_account
  from public.intermediary_portal_accounts
  where auth_user_id = v_uid
  for update;

  if not found or v_account.status = 'disabled' then
    raise exception 'Partner portal account is not available' using errcode='28000';
  end if;

  v_partner_id := public.partner_app_resolve_partner_family(v_account.intermediary_id);
  if v_partner_id is null then
    raise exception 'Intermediary account does not resolve to one active permanent Partner family' using errcode='28000';
  end if;

  if v_account.status = 'invited' then
    update public.intermediary_portal_accounts
      set status='active',
          activated_at=coalesce(activated_at,v_now),
          disabled_at=null,
          updated_at=v_now
    where id=v_account.id;

    update public.intermediaries
      set portal_access_status='active', updated_at=v_now
    where id=v_account.intermediary_id;

    insert into public.intermediary_portal_account_audit(
      portal_account_id, intermediary_id, auth_user_id, event_type, actor_profile_id
    ) values (
      v_account.id, v_account.intermediary_id, v_uid, 'activated', v_uid
    );
  end if;

  return public.partner_app_current_identity();
end;
$$;

create or replace function public.service_disable_intermediary_portal_account(
  p_intermediary_id uuid,
  p_actor_profile_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_account public.intermediary_portal_accounts%rowtype;
  v_now timestamptz := now();
begin
  select * into v_account
  from public.intermediary_portal_accounts
  where intermediary_id=p_intermediary_id
  for update;

  if not found then
    raise exception 'Portal account not found';
  end if;

  update public.intermediary_portal_accounts
    set status='disabled', disabled_at=v_now, updated_by=p_actor_profile_id, updated_at=v_now
  where id=v_account.id;

  update public.intermediaries
    set portal_access_status='disabled', updated_at=v_now
  where id=p_intermediary_id;

  insert into public.intermediary_portal_account_audit(
    portal_account_id, intermediary_id, auth_user_id, event_type, actor_profile_id, details
  ) values (
    v_account.id, p_intermediary_id, v_account.auth_user_id, 'disabled', p_actor_profile_id,
    jsonb_build_object('reason', nullif(btrim(coalesce(p_reason,'')),''))
  );

  return jsonb_build_object('intermediary_id',p_intermediary_id,'status','disabled');
end;
$$;

revoke all on function public.partner_app_activate_current_account() from public, anon;
grant execute on function public.partner_app_activate_current_account() to authenticated, service_role;

revoke all on function public.service_disable_intermediary_portal_account(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.service_disable_intermediary_portal_account(uuid,uuid,text) to service_role;

commit;
