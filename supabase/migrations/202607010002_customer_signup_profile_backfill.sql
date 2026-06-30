create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role public.app_role;
  next_name text;
  next_phone text;
  next_email text;
begin
  next_role := coalesce(nullif(new.raw_app_meta_data ->> 'app_role', ''), nullif(new.raw_user_meta_data ->> 'app_role', ''), 'customer')::public.app_role;
  next_name := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), 'New user');
  next_phone := coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), '');
  next_email := nullif(new.email, '');

  insert into public.profiles (id, role, full_name, phone, email)
  values (new.id, next_role, next_name, nullif(next_phone, ''), next_email)
  on conflict (id) do update
  set
    role = excluded.role,
    full_name = case when public.profiles.full_name in ('', 'New user') then excluded.full_name else public.profiles.full_name end,
    phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone),
    email = coalesce(public.profiles.email, excluded.email);

  if next_role = 'customer' then
    insert into public.customers (profile_id, customer_code, contact_name, phone, email)
    values (
      new.id,
      'CUST-' || upper(substr(replace(new.id::text, '-', ''), 1, 10)),
      next_name,
      next_phone,
      next_email
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

insert into public.profiles (id, role, full_name, phone, email)
select
  u.id,
  coalesce(nullif(u.raw_app_meta_data ->> 'app_role', ''), nullif(u.raw_user_meta_data ->> 'app_role', ''), 'customer')::public.app_role,
  coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), 'New user'),
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  nullif(u.email, '')
from auth.users u
on conflict (id) do update
set
  full_name = case when public.profiles.full_name in ('', 'New user') then excluded.full_name else public.profiles.full_name end,
  phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone),
  email = coalesce(public.profiles.email, excluded.email);

insert into public.customers (profile_id, customer_code, contact_name, phone, email)
select
  p.id,
  'CUST-' || upper(substr(replace(p.id::text, '-', ''), 1, 10)),
  coalesce(nullif(p.full_name, ''), 'Customer'),
  coalesce(p.phone, ''),
  coalesce(p.email, u.email)
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'customer'
  and not exists (
    select 1
    from public.customers c
    where c.profile_id = p.id
  );
