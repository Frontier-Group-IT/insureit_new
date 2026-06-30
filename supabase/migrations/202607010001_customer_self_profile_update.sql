drop policy if exists "customers self update" on public.customers;

create policy "customers self update"
on public.customers
for update
to authenticated
using (
  profile_id = auth.uid()
)
with check (
  profile_id = auth.uid()
);

drop policy if exists "profiles self update customer contact" on public.profiles;

create policy "profiles self update customer contact"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  and role = 'customer'
)
with check (
  id = auth.uid()
  and role = 'customer'
);
