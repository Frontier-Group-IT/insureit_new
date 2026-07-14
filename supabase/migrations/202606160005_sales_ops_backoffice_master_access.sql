create or replace function public.can_manage_sales_records()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in (
    'sales_operations_head',
    'backoffice_executive',
    'sales_head',
    'zonal_head',
    'asm',
    'sales_manager',
    'agent'
  );
$$;
create or replace function public.can_access_full_business_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in (
    'super_admin',
    'admin',
    'it_super_user',
    'director',
    'sales_operations_head',
    'backoffice_executive',
    'manager',
    'claims_head',
    'claim_processor',
    'field_executive'
  );
$$;
create or replace function public.can_access_profile(viewer_id uuid, target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_role text;
  target_role text;
begin
  if viewer_id is null or target_profile_id is null then
    return false;
  end if;

  if viewer_id = target_profile_id then
    return true;
  end if;

  select role::text into viewer_role from public.profiles where id = viewer_id and is_active = true;
  select role::text into target_role from public.profiles where id = target_profile_id;

  if viewer_role is null then
    return false;
  end if;

  if viewer_role in ('it_super_user', 'admin', 'super_admin') then
    return true;
  end if;

  if viewer_role in ('sales_operations_head', 'backoffice_executive') and target_role = 'agent' then
    return true;
  end if;

  if viewer_role = 'director' then
    return coalesce(target_role, '') not in ('it_super_user', 'admin', 'super_admin');
  end if;

  if viewer_role = 'customer' then
    return false;
  end if;

  return exists (
    select 1
    from public.get_user_downline(viewer_id) d
    where d.profile_id = target_profile_id
  );
end;
$$;
drop policy if exists "customers sales hierarchy insert" on public.customers;
create policy "customers sales hierarchy insert"
on public.customers for insert
to authenticated
with check (
  (
    public.current_app_role()::text in ('sales_operations_head', 'backoffice_executive')
    and exists (
      select 1 from public.profiles p
      where p.id = assigned_agent_id and p.role::text = 'agent' and p.is_active = true
    )
  )
  or (
    public.can_manage_sales_records()
    and assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
  )
  or (
    public.current_app_role()::text = 'customer'
    and profile_id = auth.uid()
  )
);
drop policy if exists "customers sales hierarchy update" on public.customers;
create policy "customers sales hierarchy update"
on public.customers for update
to authenticated
using (
  public.current_app_role()::text in ('sales_operations_head', 'backoffice_executive')
  or (
    public.can_manage_sales_records()
    and assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
  )
)
with check (
  (
    public.current_app_role()::text in ('sales_operations_head', 'backoffice_executive')
    and exists (
      select 1 from public.profiles p
      where p.id = assigned_agent_id and p.role::text = 'agent' and p.is_active = true
    )
  )
  or (
    public.can_manage_sales_records()
    and assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
  )
);
