-- Read-only, service-role-only Partner Register metrics.
-- Attribution matches partner_app_commercial_scope: Partner application and linked
-- POSP/MISP onboarding profiles. Do not broaden to unrelated RM/group business.
create or replace function public.partner_register_business_metrics(p_partner_ids uuid[])
returns table (
  partner_id uuid,
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
  customer_totals as (
    select f.partner_id, count(distinct c.id)::bigint as customer_count
    from family f
    join public.customers c on c.lead_source_intermediary_id = f.intermediary_id
    group by f.partner_id
  ),
  policy_family as (
    select distinct f.partner_id, p.id as policy_id
    from family f
    join public.policies p
      on upper(btrim(p.intermediary_code)) = upper(btrim(f.intermediary_code))
    where nullif(btrim(f.intermediary_code), '') is not null
  ),
  premium_totals as (
    select pf.partner_id, coalesce(sum(ppd.net_premium), 0)::numeric as net_premium
    from policy_family pf
    join public.policy_premium_details ppd on ppd.policy_id = pf.policy_id
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
  select sp.id, coalesce(ct.customer_count, 0), coalesce(pt.net_premium, 0),
    coalesce(pot.payout, 0)
  from selected_partners sp
  left join customer_totals ct on ct.partner_id = sp.id
  left join premium_totals pt on pt.partner_id = sp.id
  left join payout_totals pot on pot.partner_id = sp.id;
$$;

revoke all on function public.partner_register_business_metrics(uuid[]) from public, anon, authenticated;
grant execute on function public.partner_register_business_metrics(uuid[]) to service_role;
comment on function public.partner_register_business_metrics(uuid[])
is 'Batched lifetime partner-family customer, policy net premium and intermediary payout totals for authorized server-side Partner Register.';
