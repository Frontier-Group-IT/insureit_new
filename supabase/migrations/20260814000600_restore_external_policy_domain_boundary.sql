begin;

create temporary table _external_policy_move_map (
  policy_id uuid primary key,
  external_policy_id uuid not null
) on commit drop;

insert into public.external_policies (
  customer_id, vehicle_id, insurance_company_id, policy_no, policy_type,
  start_date, end_date, premium_amount, insured_declared_value,
  added_by, added_via, created_at, updated_at
)
select
  p.customer_id, p.vehicle_id, p.insurance_company_id, p.policy_no, p.policy_type,
  p.start_date, p.end_date, p.premium_amount, p.insured_declared_value,
  p.created_by, 'customer_app', p.created_at, p.updated_at
from public.policies p
where p.policy_service_source = 'external'::public.policy_service_source
on conflict do nothing;

insert into _external_policy_move_map (policy_id, external_policy_id)
select p.id, ep.id
from public.policies p
join public.external_policies ep
  on ep.customer_id = p.customer_id
 and upper(ep.policy_no) = upper(p.policy_no)
where p.policy_service_source = 'external'::public.policy_service_source;

update public.claims c
set external_policy_id = m.external_policy_id,
    policy_id = null,
    policy_service_source = 'external'::public.policy_service_source,
    updated_at = now()
from _external_policy_move_map m
where c.policy_id = m.policy_id;

delete from public.policies p
using _external_policy_move_map m
where p.id = m.policy_id;

create or replace function public.create_customer_policy(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_insurance_company_id uuid,
  p_policy_no text,
  p_policy_type text,
  p_start_date date,
  p_end_date date,
  p_premium_amount numeric default null,
  p_insured_declared_value numeric default null
)
returns public.policies
language plpgsql
security definer
set search_path = public
as $$
declare
  ext public.external_policies;
  result public.policies;
begin
  ext := public.create_customer_external_policy(
    p_customer_id, p_vehicle_id, p_insurance_company_id, p_policy_no,
    p_policy_type, p_start_date, p_end_date, p_premium_amount,
    p_insured_declared_value
  );

  result.id := ext.id;
  result.customer_id := ext.customer_id;
  result.vehicle_id := ext.vehicle_id;
  result.insurance_company_id := ext.insurance_company_id;
  result.policy_no := ext.policy_no;
  result.policy_type := ext.policy_type;
  result.start_date := ext.start_date;
  result.end_date := ext.end_date;
  result.premium_amount := ext.premium_amount;
  result.insured_declared_value := ext.insured_declared_value;
  result.created_at := ext.created_at;
  result.updated_at := ext.updated_at;
  result.policy_service_source := 'external'::public.policy_service_source;
  return result;
end;
$$;

grant execute on function public.create_customer_policy(uuid, uuid, uuid, text, text, date, date, numeric, numeric) to authenticated;
grant execute on function public.create_customer_external_policy(uuid, uuid, uuid, text, text, date, date, numeric, numeric) to authenticated;

commit;
