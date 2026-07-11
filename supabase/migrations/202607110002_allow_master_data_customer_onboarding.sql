-- Allow authorised master-data managers to create and maintain customer records
-- without requiring a sales hierarchy assignment during onboarding.

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
