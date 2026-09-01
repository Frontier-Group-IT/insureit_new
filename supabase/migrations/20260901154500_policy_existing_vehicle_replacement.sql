begin;

alter table public.policies
  add column if not exists supersedes_policy_id uuid references public.policies(id) on delete set null,
  add column if not exists superseded_by_policy_id uuid references public.policies(id) on delete set null,
  add column if not exists superseded_effective_date date,
  add column if not exists supersession_reason text,
  add column if not exists superseded_by uuid;

create index if not exists policies_supersedes_policy_idx on public.policies (supersedes_policy_id) where supersedes_policy_id is not null;
create index if not exists policies_superseded_by_policy_idx on public.policies (superseded_by_policy_id) where superseded_by_policy_id is not null;

create table if not exists public.policy_replacement_audit (
  id uuid primary key default gen_random_uuid(),
  existing_policy_id uuid not null references public.policies(id) on delete restrict,
  new_policy_id uuid not null references public.policies(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  replacement_effective_date date not null,
  reason text not null,
  replaced_by uuid,
  existing_policy_status_before text not null,
  existing_policy_original_end_date date not null,
  created_at timestamptz not null default now()
);

alter table public.policy_replacement_audit enable row level security;
revoke all on table public.policy_replacement_audit from public, anon, authenticated;
grant all on table public.policy_replacement_audit to service_role;

create or replace function public.replace_active_motor_policy_v1(
  p_existing_policy_id uuid,
  p_payload jsonb,
  p_reason text,
  p_effective_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.policies%rowtype;
  v_vehicle_id uuid;
  v_registration text;
  v_actor uuid;
  v_result jsonb;
  v_new_policy_id uuid;
  v_original_status text;
  v_original_end_date date;
begin
  if p_existing_policy_id is null then raise exception 'Replacement policy reference is required.'; end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'Replacement reason is required.'; end if;
  if p_effective_date is null then raise exception 'Replacement effective date is required.'; end if;

  select * into v_existing from public.policies where id = p_existing_policy_id for update;
  if not found then raise exception 'The existing policy is no longer available.'; end if;

  if lower(coalesce(v_existing.status, 'active')) in ('cancelled','canceled','rejected','superseded','void') then
    raise exception 'The selected policy is not eligible for active-policy replacement.';
  end if;

  if v_existing.start_date > (now() at time zone 'Asia/Kolkata')::date
     or v_existing.end_date < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Only a currently active policy can be replaced from Policy Onboarding.';
  end if;

  if p_effective_date < (now() at time zone 'Asia/Kolkata')::date
     or p_effective_date <= v_existing.start_date
     or p_effective_date > v_existing.end_date then
    raise exception 'Replacement effective date must be today or later, after the existing policy start date, and on or before its contractual end date.';
  end if;

  if nullif(p_payload #>> '{policy,validFrom}', '')::date is distinct from p_effective_date then
    raise exception 'The replacement effective date must match the new policy Valid From date.';
  end if;

  v_registration := upper(regexp_replace(coalesce(p_payload #>> '{vehicle,registrationNumber}', ''), '[^A-Za-z0-9]', '', 'g'));
  select id into v_vehicle_id from public.vehicles where vehicle_no_normalized = v_registration;
  if v_vehicle_id is null or v_vehicle_id <> v_existing.vehicle_id then
    raise exception 'The replacement policy must be booked against the same existing vehicle.';
  end if;

  v_actor := nullif(p_payload #>> '{meta,requestedBy}', '')::uuid;
  v_original_status := coalesce(v_existing.status, 'active');
  v_original_end_date := v_existing.end_date;

  update public.policies
  set status='superseded', superseded_effective_date=p_effective_date, supersession_reason=btrim(p_reason), superseded_by=v_actor, updated_at=now()
  where id=v_existing.id;

  v_result := public.onboard_motor_policy_commercial_status_v2(p_payload);
  if coalesce((v_result ->> 'ok')::boolean, false) is not true then
    raise exception 'The replacement policy could not be created.';
  end if;

  v_new_policy_id := nullif(v_result ->> 'policyId', '')::uuid;
  if v_new_policy_id is null then raise exception 'The replacement policy result did not include a policy ID.'; end if;

  update public.policies set superseded_by_policy_id=v_new_policy_id, updated_at=now() where id=v_existing.id;
  update public.policies set supersedes_policy_id=v_existing.id, updated_at=now() where id=v_new_policy_id;

  insert into public.policy_replacement_audit(existing_policy_id,new_policy_id,vehicle_id,replacement_effective_date,reason,replaced_by,existing_policy_status_before,existing_policy_original_end_date)
  values(v_existing.id,v_new_policy_id,v_existing.vehicle_id,p_effective_date,btrim(p_reason),v_actor,v_original_status,v_original_end_date);

  insert into public.audit_logs(actor_id,action,table_name,record_id)
  values
    (v_actor,'policy_superseded','policies',v_existing.id),
    (v_actor,'policy_replacement_created','policies',v_new_policy_id);

  return v_result || jsonb_build_object('replacedPolicyId',v_existing.id,'replacementEffectiveDate',p_effective_date);
end;
$$;

revoke all on function public.replace_active_motor_policy_v1(uuid,jsonb,text,date) from public, anon, authenticated;
grant execute on function public.replace_active_motor_policy_v1(uuid,jsonb,text,date) to service_role;

commit;
