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
  next_phone := coalesce(nullif(new.phone, ''), nullif(new.raw_user_meta_data ->> 'phone', ''), '');
  next_email := coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data ->> 'email', ''));

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
      coalesce(nullif(next_phone, ''), ''),
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
  coalesce(nullif(u.phone, ''), nullif(u.raw_user_meta_data ->> 'phone', '')),
  coalesce(nullif(u.email, ''), nullif(u.raw_user_meta_data ->> 'email', ''))
from auth.users u
on conflict (id) do update
set
  full_name = case when public.profiles.full_name in ('', 'New user') then excluded.full_name else public.profiles.full_name end,
  phone = coalesce(nullif(public.profiles.phone, ''), excluded.phone),
  email = coalesce(public.profiles.email, excluded.email);

-- Reuse an existing customer with the same normalized mobile before attempting
-- to create a new row. This keeps auth/profile backfills compatible with the
-- single-customer-per-mobile constraint.
update public.customers c
set
  profile_id = p.id,
  contact_name = case when c.contact_name in ('', 'Customer', 'New user') then coalesce(nullif(p.full_name, ''), c.contact_name) else c.contact_name end,
  phone = coalesce(nullif(c.phone, ''), p.phone, u.phone, ''),
  email = coalesce(c.email, p.email, u.email, nullif(u.raw_user_meta_data ->> 'email', '')),
  updated_at = now()
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'customer'
  and c.profile_id is null
  and length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 10
  and right(regexp_replace(c.phone, '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p.phone, u.phone, ''), '\D', '', 'g'), 10)
  and not exists (
    select 1 from public.customers linked where linked.profile_id = p.id
  );

insert into public.customers (profile_id, customer_code, contact_name, phone, email)
select
  p.id,
  'CUST-' || upper(substr(replace(p.id::text, '-', ''), 1, 10)),
  coalesce(nullif(p.full_name, ''), 'Customer'),
  coalesce(p.phone, u.phone, ''),
  coalesce(p.email, u.email, nullif(u.raw_user_meta_data ->> 'email', ''))
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'customer'
  and not exists (
    select 1
    from public.customers c
    where c.profile_id = p.id
  )
  and not exists (
    select 1
    from public.customers c
    where length(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')) >= 10
      and right(regexp_replace(c.phone, '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p.phone, u.phone, ''), '\D', '', 'g'), 10)
  );

update public.customers c
set
  phone = coalesce(nullif(c.phone, ''), p.phone, u.phone, ''),
  email = coalesce(c.email, p.email, u.email, nullif(u.raw_user_meta_data ->> 'email', '')),
  updated_at = now()
from public.profiles p
join auth.users u on u.id = p.id
where c.profile_id = p.id
  and p.role = 'customer'
  and (
    nullif(c.phone, '') is null
    or c.email is null
  );
