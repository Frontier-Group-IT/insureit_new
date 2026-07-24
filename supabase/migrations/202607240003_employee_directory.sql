-- Production employee directory, independent from optional portal login access.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  full_name text not null,
  phone text,
  email text,
  department text not null,
  designation text not null,
  vertical text,
  location text,
  reporting_manager_id uuid references public.employees(id) on delete set null,
  reporting_manager_employee_code text,
  employment_status text not null default 'active'
    check (employment_status in ('active', 'inactive')),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

create unique index if not exists employees_employee_code_key
  on public.employees (employee_code);

create unique index if not exists employees_email_key
  on public.employees (lower(email))
  where email is not null;

create unique index if not exists employees_phone_key
  on public.employees (phone)
  where phone is not null;

create unique index if not exists profiles_employee_id_key
  on public.profiles (employee_id)
  where employee_id is not null;

create index if not exists employees_reporting_manager_id_idx
  on public.employees (reporting_manager_id);

create index if not exists employees_status_idx
  on public.employees (employment_status);

create or replace function public.normalize_employee_record()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  phone_digits text;
begin
  new.employee_code := upper(btrim(new.employee_code));
  new.full_name := btrim(new.full_name);
  new.department := btrim(new.department);
  new.designation := btrim(new.designation);
  new.vertical := nullif(btrim(coalesce(new.vertical, '')), '');
  new.location := nullif(btrim(coalesce(new.location, '')), '');
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.reporting_manager_employee_code :=
    nullif(upper(btrim(coalesce(new.reporting_manager_employee_code, ''))), '');

  phone_digits := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if length(phone_digits) > 10 then
    phone_digits := right(phone_digits, 10);
  end if;
  new.phone := case
    when phone_digits = '' then null
    when length(phone_digits) = 10 then '+91' || phone_digits
    else new.phone
  end;

  if new.employee_code = '' then
    raise exception 'Employee code is required.';
  end if;
  if new.full_name = '' then
    raise exception 'Employee name is required.';
  end if;
  if new.department = '' then
    raise exception 'Department is required.';
  end if;
  if new.designation = '' then
    raise exception 'Designation is required.';
  end if;
  if new.phone is not null and new.phone !~ '^\+[1-9][0-9]{9,14}$' then
    raise exception 'Enter a valid mobile number.';
  end if;
  if new.email is not null and new.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address.';
  end if;
  if new.reporting_manager_id = new.id then
    raise exception 'An employee cannot report to themselves.';
  end if;

  if new.reporting_manager_id is not null then
    select employee_code
      into new.reporting_manager_employee_code
    from public.employees
    where id = new.reporting_manager_id;
  elsif new.reporting_manager_employee_code is not null then
    select id
      into new.reporting_manager_id
    from public.employees
    where employee_code = new.reporting_manager_employee_code;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists normalize_employee_record_trigger on public.employees;
create trigger normalize_employee_record_trigger
before insert or update on public.employees
for each row execute function public.normalize_employee_record();

create or replace function public.validate_employee_reporting_line()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reporting_manager_id is null then
    return new;
  end if;

  if exists (
    with recursive manager_chain as (
      select reporting_manager_id
      from public.employees
      where id = new.reporting_manager_id

      union all

      select employee.reporting_manager_id
      from public.employees employee
      join manager_chain chain on employee.id = chain.reporting_manager_id
      where employee.reporting_manager_id is not null
    )
    select 1
    from manager_chain
    where reporting_manager_id = new.id
  ) then
    raise exception 'This reporting manager would create a hierarchy cycle.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_employee_reporting_line_trigger on public.employees;
create constraint trigger validate_employee_reporting_line_trigger
after insert or update of reporting_manager_id on public.employees
deferrable initially immediate
for each row execute function public.validate_employee_reporting_line();

create or replace function public.resolve_pending_employee_managers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.employees
  set reporting_manager_id = new.id
  where reporting_manager_id is null
    and reporting_manager_employee_code = new.employee_code
    and id <> new.id;
  return new;
end;
$$;

drop trigger if exists resolve_pending_employee_managers_trigger on public.employees;
create trigger resolve_pending_employee_managers_trigger
after insert or update of employee_code on public.employees
for each row execute function public.resolve_pending_employee_managers();

create or replace function public.can_manage_employees()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in ('super_admin', 'admin', 'it_super_user');
$$;

create or replace function public.can_view_employees()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active
      and role::text <> 'customer'
  );
$$;

alter table public.employees enable row level security;

drop policy if exists "employees staff read" on public.employees;
create policy "employees staff read"
on public.employees for select
to authenticated
using (public.can_view_employees());

drop policy if exists "employees admin insert" on public.employees;
create policy "employees admin insert"
on public.employees for insert
to authenticated
with check (public.can_manage_employees());

drop policy if exists "employees admin update" on public.employees;
create policy "employees admin update"
on public.employees for update
to authenticated
using (public.can_manage_employees())
with check (public.can_manage_employees());

comment on table public.employees is
  'Authoritative employee directory. A portal profile is optional and links through profiles.employee_id.';

comment on column public.employees.reporting_manager_employee_code is
  'Preserves a pending reporting line until the referenced manager employee record exists.';
