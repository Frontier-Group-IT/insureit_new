-- Partner Register MTD ranking only. Read-only and service-role-only.
-- Keep the lifetime partner_register_business_metrics RPC and displayed totals intact.
-- Attribution intentionally matches the original Partner + linked POSP/MISP family.
create or replace function public.partner_register_mtd_net_premium(p_partner_ids uuid[])
returns table (
  partner_id uuid,
  mtd_net_premium numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with month_boundary as (
    select date_trunc('month', timezone('Asia/Kolkata', now()))::date as month_start,
           timezone('Asia/Kolkata', now())::date as today
  ),
  selected_partners as (
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
  month_policies as (
    select distinct f.partner_id, p.id as policy_id
    from family f
    join public.policies p
      on upper(btrim(p.intermediary_code)) = upper(btrim(f.intermediary_code))
    cross join month_boundary mb
    where nullif(btrim(f.intermediary_code), '') is not null
      -- Match dashboard business-date convention: issuance date, else creation date.
      and coalesce(p.issuance_date, (p.created_at at time zone 'Asia/Kolkata')::date) >= mb.month_start
      and coalesce(p.issuance_date, (p.created_at at time zone 'Asia/Kolkata')::date) <= mb.today
  ),
  totals as (
    select mp.partner_id, coalesce(sum(ppd.net_premium), 0)::numeric as amount
    from month_policies mp
    join public.policy_premium_details ppd on ppd.policy_id = mp.policy_id
    group by mp.partner_id
  )
  select sp.id, coalesce(t.amount, 0)::numeric
  from selected_partners sp
  left join totals t on t.partner_id = sp.id;
$$;

revoke all on function public.partner_register_mtd_net_premium(uuid[]) from public, anon, authenticated;
grant execute on function public.partner_register_mtd_net_premium(uuid[]) to service_role;
comment on function public.partner_register_mtd_net_premium(uuid[])
is 'Read-only current India-calendar-month net premium for authorized Partner Register family scope; resets monthly, service role only.';
