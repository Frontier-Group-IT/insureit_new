create or replace function public.can_manage_sales_records()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in (
    'sales_operations_head',
    'sales_head',
    'zonal_head',
    'asm',
    'sales_manager',
    'agent'
  );
$$;
drop policy if exists "customers hierarchy insert" on public.customers;
create policy "customers sales hierarchy insert"
on public.customers for insert
to authenticated
with check (
  (
    public.can_manage_sales_records()
    and assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
  )
  or (
    public.current_app_role()::text = 'customer'
    and profile_id = auth.uid()
  )
);
drop policy if exists "customers hierarchy update" on public.customers;
create policy "customers sales hierarchy update"
on public.customers for update
to authenticated
using (
  public.can_manage_sales_records()
  and assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
)
with check (
  public.can_manage_sales_records()
  and assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
);
drop policy if exists "vehicles hierarchy manage" on public.vehicles;
create policy "vehicles sales hierarchy insert"
on public.vehicles for insert
to authenticated
with check (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
);
create policy "vehicles sales hierarchy update"
on public.vehicles for update
to authenticated
using (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
)
with check (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
);
create policy "vehicles sales hierarchy delete"
on public.vehicles for delete
to authenticated
using (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
);
drop policy if exists "policies hierarchy manage" on public.policies;
create policy "policies sales hierarchy insert"
on public.policies for insert
to authenticated
with check (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
);
create policy "policies sales hierarchy update"
on public.policies for update
to authenticated
using (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
)
with check (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
);
create policy "policies sales hierarchy delete"
on public.policies for delete
to authenticated
using (
  public.can_manage_sales_records()
  and public.can_access_customer(auth.uid(), customer_id)
);
drop policy if exists "insurance companies ops manage" on public.insurance_companies;
create policy "insurance companies ops read"
on public.insurance_companies for select
to authenticated
using (public.is_operations_role());
create policy "insurance companies sales manage"
on public.insurance_companies for all
to authenticated
using (public.can_manage_sales_records())
with check (public.can_manage_sales_records());
