begin;

create or replace function public.partner_app_customer_activity(
  p_customer_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit,20),50));
  v_result jsonb;
begin
  if not public.partner_app_customer_in_scope(p_customer_id) then
    raise exception 'Customer is not available in this Partner scope' using errcode='42501';
  end if;

  with customer_event as (
    select
      'customer'::text as kind,
      c.id as entity_id,
      c.created_at as event_at,
      'Customer created'::text as title,
      case
        when nullif(btrim(coalesce(c.creation_channel,'')),'') is null then 'Customer profile created'
        else initcap(replace(c.creation_channel,'_',' '))
      end as meta
    from public.customers c
    where c.id=p_customer_id
  ),
  policy_events as (
    select
      'policy'::text as kind,
      p.id as entity_id,
      coalesce(p.created_at,p.issuance_date::timestamptz) as event_at,
      coalesce(p.policy_no,p.policy_code,'Policy') as title,
      concat_ws(' · ','Policy created',nullif(ic.name,''),nullif(v.vehicle_no,'')) as meta
    from public.policies p
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    left join public.vehicles v on v.id=p.vehicle_id
    where p.customer_id=p_customer_id
      and public.partner_app_policy_in_scope(p.id)
  ),
  claim_events as (
    select
      'claim'::text as kind,
      cl.id as entity_id,
      coalesce(h.created_at,cl.updated_at,cl.created_at) as event_at,
      coalesce(cl.claim_no,'Claim') as title,
      concat_ws(' · ','Claim updated',coalesce(h.to_status::text,cl.current_status::text)) as meta
    from public.claims cl
    left join lateral (
      select x.to_status,x.created_at
      from public.claim_status_history x
      where x.claim_id=cl.id
      order by x.created_at desc
      limit 1
    ) h on true
    where cl.customer_id=p_customer_id
      and public.partner_app_claim_in_scope(cl.id)
  ),
  all_events as (
    select * from customer_event
    union all
    select * from policy_events
    union all
    select * from claim_events
  ),
  ranked as (
    select *
    from all_events
    where event_at is not null
    order by event_at desc
    limit v_limit
  )
  select jsonb_build_object(
    'generated_at',now(),
    'customer_id',p_customer_id,
    'items',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'kind',kind,
          'entity_id',entity_id,
          'event_at',event_at,
          'title',title,
          'meta',meta
        )
        order by event_at desc
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from ranked;

  return v_result;
end;
$$;

revoke all on function public.partner_app_customer_activity(uuid, integer) from public, anon;
grant execute on function public.partner_app_customer_activity(uuid, integer) to authenticated, service_role;

commit;
