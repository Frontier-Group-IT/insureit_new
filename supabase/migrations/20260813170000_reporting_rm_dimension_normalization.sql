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

create or replace function public.sync_policy_rm_employee_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_employee_name text;
begin
  if tg_op = 'UPDATE'
     and new.intermediary_code is not distinct from old.intermediary_code
     and new.rm_employee_id is not null then
    select full_name into v_employee_name from public.employees where id = new.rm_employee_id;
    if v_employee_name is not null then new.rm_name := v_employee_name; end if;
    return new;
  end if;

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
set rm_employee_id = r.employee_id,
    rm_name = coalesce(r.employee_name, p.rm_name)
from resolved r
where r.policy_id = p.id and r.employee_id is not null;

create or replace function public.sync_policy_rm_name_on_employee_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.full_name is distinct from old.full_name then
    update public.policies
    set rm_name = new.full_name
    where rm_employee_id = new.id
      and rm_name is distinct from new.full_name;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_policy_rm_name_on_employee_update on public.employees;
create trigger trg_sync_policy_rm_name_on_employee_update
after update of full_name on public.employees
for each row execute function public.sync_policy_rm_name_on_employee_update();

create or replace function public.get_policy_business_report_v2(
  p_customer_ids uuid[] default null,p_from_date date default null,p_to_date date default null,
  p_insurer_id uuid default null,p_rm_employee_id uuid default null,p_intermediary_code text default null,
  p_page integer default 1,p_page_size integer default 25
) returns jsonb language sql stable security definer set search_path=public as $$
  select public.get_policy_business_report(
    p_customer_ids,p_from_date,p_to_date,p_insurer_id,
    case when p_rm_employee_id is null then null else (select full_name from public.employees where id=p_rm_employee_id) end,
    p_intermediary_code,p_page,p_page_size
  );
$$;

create or replace function public.get_finance_report_v2(
  p_customer_ids uuid[] default null,p_from_date date default null,p_to_date date default null,
  p_insurer_id uuid default null,p_rm_employee_id uuid default null,p_intermediary_code text default null,
  p_billing_status text default null,p_page integer default 1,p_page_size integer default 25
) returns jsonb language sql security definer set search_path=public as $$
  select public.get_finance_report(
    p_customer_ids,p_from_date,p_to_date,p_insurer_id,
    case when p_rm_employee_id is null then null else (select full_name from public.employees where id=p_rm_employee_id) end,
    p_intermediary_code,p_billing_status,p_page,p_page_size
  );
$$;

create or replace function public.get_renewal_report_v2(
  p_customer_ids uuid[] default null,p_horizon_days integer default 365,p_insurer_id uuid default null,
  p_rm_employee_id uuid default null,p_intermediary_code text default null,p_bucket text default null,
  p_page integer default 1,p_page_size integer default 25
) returns jsonb language sql security definer set search_path=public as $$
  select public.get_renewal_report(
    p_customer_ids,p_horizon_days,p_insurer_id,
    case when p_rm_employee_id is null then null else (select full_name from public.employees where id=p_rm_employee_id) end,
    p_intermediary_code,p_bucket,p_page,p_page_size
  );
$$;

create or replace function public.get_reporting_rm_options(p_customer_ids uuid[] default null)
returns table(id uuid,name text)
language sql stable security definer set search_path=public as $$
  select distinct p.rm_employee_id,coalesce(e.full_name,p.rm_name)
  from public.policies p
  left join public.employees e on e.id=p.rm_employee_id
  where p.rm_employee_id is not null
    and (p_customer_ids is null or p.customer_id=any(p_customer_ids))
  order by 2;
$$;

revoke all on function public.get_policy_business_report_v2(uuid[],date,date,uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_policy_business_report_v2(uuid[],date,date,uuid,uuid,text,integer,integer) to postgres,service_role;
revoke all on function public.get_finance_report_v2(uuid[],date,date,uuid,uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_finance_report_v2(uuid[],date,date,uuid,uuid,text,text,integer,integer) to postgres,service_role;
revoke all on function public.get_renewal_report_v2(uuid[],integer,uuid,uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.get_renewal_report_v2(uuid[],integer,uuid,uuid,text,text,integer,integer) to postgres,service_role;
revoke all on function public.get_reporting_rm_options(uuid[]) from public,anon,authenticated;
grant execute on function public.get_reporting_rm_options(uuid[]) to postgres,service_role;