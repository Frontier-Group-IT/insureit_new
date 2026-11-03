-- Keep customer-visible Stage 2 fields in sync for internal, broker-managed
-- claims. Operations owns claim_stage_details; customers read claim_milestones
-- through existing customer-scoped RLS. Never expose the full Operations JSON.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_internal_spot_status_customer_milestone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  visible_details jsonb;
  done_at timestamptz;
begin
  if new.details->>'milestone_key' is distinct from 'spot_status' then
    return new;
  end if;

  -- Only the internal broker-managed journey. Never alter self-managed or
  -- external claim milestones, and never trust IDs supplied by a client.
  if not exists (
    select 1 from public.claims c
    where c.id = new.claim_id
      and c.claim_service_mode = 'broker_managed'
      and c.external_policy_id is null
      and (c.policy_service_source is null or c.policy_service_source <> 'external')
  ) then
    return new;
  end if;

  visible_details := jsonb_strip_nulls(jsonb_build_object(
    'spot_survey_done_date', nullif(trim(new.details->>'spot_survey_done_date'), ''),
    'surveyor_name', nullif(trim(new.details->>'surveyor_name'), ''),
    'surveyor_email', nullif(trim(new.details->>'surveyor_email'), ''),
    'surveyor_phone', nullif(trim(new.details->>'surveyor_phone'), '')
  ));
  done_at := nullif(new.details->>'completed_at', '')::timestamptz;

  insert into public.claim_milestones (
    claim_id, milestone_key, milestone_status, details, completed_at,
    recorded_by, recorded_by_actor, updated_at
  )
  values (
    new.claim_id, 'spot_status',
    case when done_at is null
      then 'in_progress'::public.claim_milestone_status
      else 'completed'::public.claim_milestone_status end,
    visible_details, done_at, null, 'system', now()
  )
  on conflict (claim_id, milestone_key) do update
    set details = excluded.details,
        milestone_status = case
          when excluded.milestone_status = 'completed' then 'completed'::public.claim_milestone_status
          else public.claim_milestones.milestone_status end,
        completed_at = coalesce(excluded.completed_at, public.claim_milestones.completed_at),
        recorded_by_actor = 'system',
        updated_at = now();

  return new;
end;
$function$;

-- Only the trusted trigger may invoke this privileged function.
revoke all on function private.sync_internal_spot_status_customer_milestone()
  from public, anon, authenticated;

drop trigger if exists sync_internal_spot_status_customer_milestone
  on public.claim_stage_details;

create trigger sync_internal_spot_status_customer_milestone
after insert on public.claim_stage_details
for each row
when (new.details->>'milestone_key' = 'spot_status')
execute function private.sync_internal_spot_status_customer_milestone();

-- Repair pre-existing internal Stage 2 records, including claim SIBL/1136.
-- Choose latest entry per claim. No changes to claims, customer records or
-- internal Operations stage details.
with latest as (
  select distinct on (d.claim_id)
    d.claim_id, d.details, d.created_at
  from public.claim_stage_details d
  join public.claims c on c.id = d.claim_id
  where d.details->>'milestone_key' = 'spot_status'
    and c.claim_service_mode = 'broker_managed'
    and c.external_policy_id is null
    and (c.policy_service_source is null or c.policy_service_source <> 'external')
  order by d.claim_id, d.created_at desc
), prepared as (
  select
    claim_id,
    jsonb_strip_nulls(jsonb_build_object(
      'spot_survey_done_date', nullif(trim(details->>'spot_survey_done_date'), ''),
      'surveyor_name', nullif(trim(details->>'surveyor_name'), ''),
      'surveyor_email', nullif(trim(details->>'surveyor_email'), ''),
      'surveyor_phone', nullif(trim(details->>'surveyor_phone'), '')
    )) as public_details,
    nullif(details->>'completed_at', '')::timestamptz as done_at
  from latest
)
insert into public.claim_milestones (
  claim_id, milestone_key, milestone_status, details, completed_at,
  recorded_by, recorded_by_actor, updated_at
)
select
  claim_id,
  'spot_status',
  case when done_at is null
    then 'in_progress'::public.claim_milestone_status
    else 'completed'::public.claim_milestone_status end,
  public_details,
  done_at,
  null,
  'system',
  now()
from prepared
on conflict (claim_id, milestone_key) do update
  set details = excluded.details,
      milestone_status = case
        when excluded.milestone_status = 'completed' then 'completed'::public.claim_milestone_status
        else public.claim_milestones.milestone_status end,
      completed_at = coalesce(excluded.completed_at, public.claim_milestones.completed_at),
      recorded_by_actor = 'system',
      updated_at = now();
