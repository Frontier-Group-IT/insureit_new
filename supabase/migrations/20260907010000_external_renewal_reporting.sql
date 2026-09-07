begin;

create or replace function public.partner_app_external_renewal_reporting()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_total bigint := 0;
  v_contacted bigint := 0;
  v_connected bigint := 0;
  v_quote_requested bigint := 0;
  v_quote_shared bigint := 0;
  v_converted bigint := 0;
  v_closed_without_conversion bigint := 0;
  v_premium numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none')='none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  with scoped as (
    select o.id, o.partner_id, o.opportunity_status
    from public.external_renewal_opportunities o
    join public.external_renewal_import_batches b on b.id=o.batch_id
    where o.partner_id=any(v_partner_ids)
      and b.status='published'
      and o.is_active
  ),
  interaction_flags as (
    select
      s.id,
      bool_or(i.id is not null) as contacted,
      bool_or(i.outcome in ('connected','interested','quote_requested','quote_shared','follow_up')) as connected,
      bool_or(i.outcome in ('quote_requested','quote_shared')) as quote_requested,
      bool_or(i.outcome='quote_shared') as quote_shared
    from scoped s
    left join public.external_renewal_interactions i
      on i.opportunity_id=s.id and i.partner_id=s.partner_id
    group by s.id
  ),
  converted as (
    select distinct
      s.id as opportunity_id,
      r.final_policy_id
    from scoped s
    join public.external_renewal_policy_intake_links l
      on l.opportunity_id=s.id and l.partner_id=s.partner_id
    join public.policy_intake_requests r on r.id=l.intake_id
    where r.final_policy_id is not null
  ),
  converted_policies as (
    select distinct c.final_policy_id
    from converted c
    where c.final_policy_id is not null
  )
  select
    (select count(*) from scoped),
    (select count(*) from interaction_flags where contacted),
    (select count(*) from interaction_flags where connected),
    (select count(*) from interaction_flags where quote_requested),
    (select count(*) from interaction_flags where quote_shared),
    (select count(*) from converted),
    (select count(*) from scoped s where s.opportunity_status in ('renewed_elsewhere','lost')),
    coalesce((
      select sum(coalesce(p.premium_amount,0))
      from converted_policies cp
      join public.policies p on p.id=cp.final_policy_id
    ),0)
  into
    v_total,
    v_contacted,
    v_connected,
    v_quote_requested,
    v_quote_shared,
    v_converted,
    v_closed_without_conversion,
    v_premium;

  return jsonb_build_object(
    'total_opportunities', v_total,
    'contacted_count', v_contacted,
    'connected_count', v_connected,
    'quote_requested_count', v_quote_requested,
    'quote_shared_count', v_quote_shared,
    'converted_count', v_converted,
    'closed_without_conversion_count', v_closed_without_conversion,
    'conversion_rate_pct', case when v_total > 0 then round((v_converted::numeric * 100) / v_total, 1) else 0 end,
    'premium_generated', v_premium
  );
end;
$$;

revoke all on function public.partner_app_external_renewal_reporting() from public, anon;
grant execute on function public.partner_app_external_renewal_reporting() to authenticated, service_role;

commit;
