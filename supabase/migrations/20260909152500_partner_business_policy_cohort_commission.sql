begin;

create or replace function public.partner_app_business_range(
  p_from_date date,
  p_to_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_identity jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_intermediary_code text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_range_days integer;
  v_previous_from date;
  v_previous_to date;
  v_result jsonb;
begin
  if p_from_date is null or p_to_date is null then
    raise exception 'From date and To date are required' using errcode='22023';
  end if;
  if p_from_date > p_to_date then
    raise exception 'From date cannot be after To date' using errcode='22023';
  end if;

  v_range_days := (p_to_date - p_from_date) + 1;
  if v_range_days > 366 then
    raise exception 'Date range cannot exceed 366 days' using errcode='22023';
  end if;
  v_previous_to := p_from_date - 1;
  v_previous_from := p_from_date - v_range_days;

  v_identity := public.partner_app_current_identity();
  v_scope := public.partner_app_commercial_scope();
  if v_identity is null or v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode','none');
  v_intermediary_code := nullif(btrim(v_identity ->> 'intermediary_code'), '');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'group_ids','[]'::jsonb)) value;

  with scoped_policies as (
    select
      p.*,
      coalesce(ppd.gross_premium,p.premium_amount,0) as effective_premium,
      coalesce(p.issuance_date,p.created_at::date) as business_date,
      i.id as scoped_intermediary_id
    from public.policies p
    left join public.policy_premium_details ppd on ppd.policy_id=p.id
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        when v_actor_kind='employee' then
          p.rm_employee_id=any(v_employee_ids)
          or i.id=any(v_intermediary_ids)
          or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
        else false
      end
  ),
  range_policy_cohort as (
    select *
    from scoped_policies
    where business_date between p_from_date and p_to_date
  ),
  scoped_customers as (
    select c.*
    from public.customers c
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        else c.lead_source_intermediary_id=any(v_intermediary_ids)
      end
  ),
  scoped_claims as (
    select cl.*
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        else c.lead_source_intermediary_id=any(v_intermediary_ids)
      end
  ),
  policy_stats as (
    select
      count(*)::int as policies,
      coalesce(sum(effective_premium),0) as premium,
      coalesce((
        select sum(sp.effective_premium)
        from scoped_policies sp
        where sp.business_date between v_previous_from and v_previous_to
      ),0) as premium_previous_period,
      (
        select count(*)::int
        from scoped_policies sp
        where sp.end_date between p_from_date and p_to_date
      ) as renewals
    from range_policy_cohort
  ),
  payout_stats as (
    -- Commission Earned is deliberately derived from the exact policy IDs in
    -- range_policy_cohort. Payout dates/updated dates do not create a second
    -- independent date cohort. Keep the existing payout authorization boundary:
    -- intermediary actors can see only payout rows for their own intermediary code.
    select coalesce(sum(
      case
        when pip.payout_basis is not null then coalesce(pip.partner_payout_amount,0)
        else coalesce(pip.gross_payout,0)
      end
    ),0) as commission_earned
    from public.policy_intermediary_payouts pip
    join range_policy_cohort rpc on rpc.id=pip.policy_id
    where v_actor_kind='intermediary'
      and v_intermediary_code is not null
      and upper(coalesce(pip.intermediary_code,''))=upper(v_intermediary_code)
  ),
  customer_stats as (
    select count(*) filter(where created_at::date between p_from_date and p_to_date)::int as customers
    from scoped_customers
  ),
  claim_stats as (
    select count(*) filter(where created_at::date between p_from_date and p_to_date)::int as claims
    from scoped_claims
  )
  select jsonb_build_object(
    'generated_at', now(),
    'from_date', p_from_date,
    'to_date', p_to_date,
    'premium', ps.premium,
    'premium_previous_period', ps.premium_previous_period,
    'premium_change_percent',
      case
        when ps.premium_previous_period > 0
          then round(((ps.premium-ps.premium_previous_period)/ps.premium_previous_period*100)::numeric,1)
        when ps.premium > 0 then 100::numeric
        else 0::numeric
      end,
    'policies', ps.policies,
    'commission_available', (v_actor_kind='intermediary' and v_intermediary_code is not null),
    'commission_earned', case
      when v_actor_kind='intermediary' and v_intermediary_code is not null then pos.commission_earned
      else null
    end,
    'customers', cs.customers,
    'renewals', ps.renewals,
    'claims', cls.claims
  )
  into v_result
  from policy_stats ps
  cross join payout_stats pos
  cross join customer_stats cs
  cross join claim_stats cls;

  return v_result;
end;
$$;

revoke all on function public.partner_app_business_range(date,date) from public, anon;
grant execute on function public.partner_app_business_range(date,date) to authenticated, service_role;

commit;