-- Reporting UX R6: stable Relationship Manager identity on policy records.

alter table public.policies add column if not exists rm_employee_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'policies_rm_employee_id_fkey'
      and conrelid = 'public.policies'::regclass
  ) then
    alter table public.policies
      add constraint policies_rm_employee_id_fkey
      foreign key (rm_employee_id) references public.employees(id) on delete set null;
  end if;
end $$;

create index if not exists policies_rm_employee_id_idx on public.policies(rm_employee_id);

create or replace function public.sync_policy_rm_employee_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_employee_name text;
begin
  v_employee_id := null;
  v_employee_name := null;
  if nullif(btrim(new.intermediary_code), '') is not null then
    select coalesce(i.associate_employee_id, op.associate_employee_id), e.full_name
      into v_employee_id, v_employee_name
    from public.intermediaries i
    left join public.posp_misp_onboarding_profiles op on op.application_id = i.application_id
    left join public.employees e on e.id = coalesce(i.associate_employee_id, op.associate_employee_id)
    where i.intermediary_code = new.intermediary_code
    order by i.updated_at desc nulls last, i.created_at desc nulls last
    limit 1;
  end if;
  if v_employee_id is null and nullif(btrim(new.rm_name), '') is not null then
    select min(e.id), min(e.full_name)
      into v_employee_id, v_employee_name
    from public.employees e
    where lower(btrim(e.full_name)) = lower(btrim(new.rm_name))
    having count(*) = 1;
  end if;
  new.rm_employee_id := v_employee_id;
  if v_employee_name is not null then new.rm_name := v_employee_name; end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_policy_rm_employee_id on public.policies;
create trigger trg_sync_policy_rm_employee_id
before insert or update of intermediary_code, rm_name on public.policies
for each row execute function public.sync_policy_rm_employee_id();

with resolved as (
  select p.id policy_id,
         coalesce(i.associate_employee_id, op.associate_employee_id) employee_id,
         e.full_name employee_name
  from public.policies p
  left join public.intermediaries i on i.intermediary_code = p.intermediary_code
  left join public.posp_misp_onboarding_profiles op on op.application_id = i.application_id
  left join public.employees e on e.id = coalesce(i.associate_employee_id, op.associate_employee_id)
)
update public.policies p
set rm_employee_id = r.employee_id, rm_name = coalesce(r.employee_name, p.rm_name)
from resolved r
where r.policy_id = p.id and r.employee_id is not null;

with unique_names as (
  select lower(btrim(full_name)) normalized_name,
         min(id) employee_id,
         min(full_name) employee_name
  from public.employees
  where nullif(btrim(full_name), '') is not null
  group by lower(btrim(full_name))
  having count(*) = 1
)
update public.policies p
set rm_employee_id = u.employee_id, rm_name = u.employee_name
from unique_names u
where p.rm_employee_id is null
  and nullif(btrim(p.rm_name), '') is not null
  and lower(btrim(p.rm_name)) = u.normalized_name;
