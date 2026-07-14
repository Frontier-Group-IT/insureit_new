-- Allow authorised master-data managers to create and maintain customer records
-- without requiring a sales hierarchy assignment during onboarding.

drop policy if exists "Master data managers can insert customers" on public.customers;
create policy "Master data managers can insert customers"
on public.customers
for insert
to authenticated
with check (
  public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user'
  )
);

drop policy if exists "Master data managers can update customers" on public.customers;
create policy "Master data managers can update customers"
on public.customers
for update
to authenticated
using (
  public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user'
  )
)
with check (
  public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user'
  )
);
