-- Partner Register: selected-period business totals for authorized Partner IDs only.
-- A separate function preserves the legacy lifetime reporting RPC and consumers.
-- Business date = policy issuance_date (inclusive boundaries).
-- Policy family attribution matches partner_register_business_metrics exactly.
create or replace function public.partner_register_period_business_metrics(
  p_partner_ids uuid[],
  p_from_date date,
  p_to_date date
)
returns table (
  partner_id uuid,
  policy_count bigint,
  customer_count bigint,
  net_premium numeric,
  payout numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with selected_partners as (
    select p.id, p.source_application_id
    from public.partners p
    where p.id = any(coalesce(p_partner_ids, array[]::uuid[]))
  ),
  family as (
    select sp.id as partner_id, i.id as intermediary_id, i.intermediary_code
    from selected_partners sp
    join public.intermediaries i
      on i.intermediary_type = 'partner'
     and i.application_id = sp.source_application_id
    union
    select sp.id, i.id, i.intermediary_code
    from selected_partners sp
    join public.posp_misp_onboarding_profiles op on op.partner_record_id = sp.id
    join public.intermediaries i
      on i.onboarding_profile_id = op.id
     and i.intermediary_type in ('posp', 'misp')
  ),
  policy_family as (
    select distinct f.partner_id, p.id as policy_id, p.customer_id
    from family f
    join public.policies p
      on upper(btrim(p.intermediary_code)) = upper(btrim(f.intermediary_code))
    where nullif(btrim(f.intermediary_code), '') is not null
      and p.issuance_date >= p_from_date
      and p.issuance_date <= p_to_date
      and p_from_date <= p_to_date
  ),
  business_totals as (
    select pf.partner_id,
      count(distinct pf.policy_id)::bigint as policy_count,
      count(distinct pf.customer_id)::bigint as customer_count,
      coalesce(sum(ppd.net_premium), 0)::numeric as net_premium
    from policy_family pf
    left join public.policy_premium_details ppd on ppd.policy_id = pf.policy_id
    group by pf.partner_id
  ),
  payout_totals as (
    select pf.partner_id,
      coalesce(sum(case when pip.payout_basis is not null
        then coalesce(pip.partner_payout_amount, 0)
        else coalesce(pip.gross_payout, 0) end), 0)::numeric as payout
    from policy_family pf
    join public.policy_intermediary_payouts pip on pip.policy_id = pf.policy_id
    where exists (
      select 1 from family f
      where f.partner_id = pf.partner_id
        and upper(btrim(f.intermediary_code)) = upper(btrim(pip.intermediary_code))
    )
    group by pf.partner_id
  )
  select sp.id,
    coalesce(bt.policy_count, 0),
    coalesce(bt.customer_count, 0),
    coalesce(bt.net_premium, 0),
    coalesce(pt.payout, 0)
  from selected_partners sp
  left join business_totals bt on bt.partner_id = sp.id
  left join payout_totals pt on pt.partner_id = sp.id;
$$;

revoke all on function public.partner_register_period_business_metrics(uuid[],date,date) from public, anon, authenticated;
grant execute on function public.partner_register_period_business_metrics(uuid[],date,date) to service_role;
comment on function public.partner_register_period_business_metrics(uuid[],date,date)
is 'Service-role-only selected-issuance-date policy count, distinct policy customers, net premium and payout for bounded authorized partner IDs. No policies in period yields policy_count 0.';
