-- CONTROLLED PRODUCTION RELEASE STEP: DO NOT RUN UNTIL
-- (1) IT User compatible frontend is published to portal.insureit.in and verified;
-- (2) 20261020231000_it_user_operational_compatibility.sql is applied;
-- (3) 20261020231500_it_user_v2_shadow_role.sql is applied;
-- (4) a recent database backup is available.
-- Modifies ONLY the role column for four existing profiles; preserves is_active.

do $$
declare
  v_primary uuid;
  v_primary_role public.app_role;
  v_expected_count integer;
  v_updated integer;
begin
  select u.id,p.role into v_primary,v_primary_role
  from auth.users u join public.profiles p on p.id=u.id
  where lower(u.email)='it@insureit.in';

  if v_primary is null or v_primary_role::text <> 'it_super_user' then
    raise exception 'Primary IT Super User account not found or its role is incorrect.';
  end if;
  select count(*) into v_expected_count
  from public.profiles where role='it_super_user'::public.app_role and id<>v_primary;
  if v_expected_count<>4 then
    raise exception 'Expected four secondary IT Super User profiles; found %',v_expected_count;
  end if;

  update public.profiles
    set role='it_user'::public.app_role
  where role='it_super_user'::public.app_role and id<>v_primary;
  get diagnostics v_updated = row_count;
  if v_updated <> 4 then
    raise exception 'Role conversion count mismatch: %',v_updated;
  end if;
  if (select count(*) from public.profiles where role='it_super_user'::public.app_role)<>1 then
    raise exception 'Exactly one IT Super User must remain.';
  end if;

  insert into public.audit_logs(actor_id,action,table_name,record_id,new_data)
  values(v_primary,'it_user_role_conversion','profiles',v_primary,
         jsonb_build_object('converted_profiles',v_updated,'primary_role_preserved',true,'active_statuses_preserved',true));
end $$;

-- Permanent uniqueness and primary-account protection.
create or replace function public.guard_sole_it_super_user_role()
returns trigger language plpgsql security definer
set search_path=public,auth
as $fn$
declare
  v_primary uuid;
begin
  select id into v_primary from auth.users where lower(email)='it@insureit.in';
  if v_primary is null then raise exception 'Primary IT administrator identity is not available'; end if;
  if tg_op='DELETE' then
    if old.id=v_primary then raise exception 'Primary IT administrator profile cannot be deleted'; end if;
    return old;
  end if;
  if new.role='it_super_user'::public.app_role and new.id<>v_primary then
    raise exception 'Only the designated primary IT administrator can hold it_super_user';
  end if;
  if tg_op='UPDATE' and old.id=v_primary and (new.id<>old.id or new.role<>'it_super_user'::public.app_role) then
    raise exception 'Primary IT administrator cannot be demoted or reassigned';
  end if;
  return new;
end;
$fn$;

drop trigger if exists guard_sole_it_super_user_role on public.profiles;
create trigger guard_sole_it_super_user_role
before insert or update or delete on public.profiles
for each row execute function public.guard_sole_it_super_user_role();
