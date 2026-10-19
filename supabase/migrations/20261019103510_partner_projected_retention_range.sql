-- Projected retention by visible business-date cohort, not actual payment receipt.
-- Retention = projected pay-in after TDS minus projected partner payouts.
-- Scope follows partner_app_business_range_v2; never expose unscoped portfolio totals.
create or replace function public.partner_app_projected_retention_range(p_from_date date,p_to_date date)
returns numeric
language plpgsql
stable security definer
set search_path to 'public','auth'
as $function$
declare
  v_identity jsonb;
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_total numeric;
begin
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date then
    raise exception 'Invalid projected retention date range' using errcode='22023';
  end if;
  v_identity := public.partner_app_current_identity();
  v_scope := public.partner_app_commercial_scope();
  if v_identity is null or v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;
  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode','none');
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_employee_ids
    from jsonb_array_elements_text(coalesce(v_scope -> 'employee_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_intermediary_ids
    from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_group_ids
    from jsonb_array_elements_text(coalesce(v_scope -> 'group_ids','[]'::jsonb)) value;
  with scoped as (
    select p.id
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where coalesce(p.issuance_date,p.created_at::date) between p_from_date and p_to_date
    and case
      when v_scope_mode='none' then false
      when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      when v_actor_kind='employee' then p.rm_employee_id=any(v_employee_ids)
        or i.id=any(v_intermediary_ids)
        or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
      else false
    end
  ),
  payins as (
    select pd.policy_id, max(pd.payin_after_tds) as payin_after_tds
    from public.policy_payin_details pd join scoped s on s.id=pd.policy_id
    group by pd.policy_id
  ),
  payouts as (
    select pip.policy_id,
      sum(case when pip.payout_basis is not null
        then coalesce(pip.partner_payout_amount,0)
        else coalesce(pip.gross_payout,0) end) as total_payout
    from public.policy_intermediary_payouts pip join scoped s on s.id=pip.policy_id
    group by pip.policy_id
  )
  select coalesce(sum(coalesce(py.payin_after_tds,0)-coalesce(po.total_payout,0)),0)
    into v_total
  from scoped s
  left join payins py on py.policy_id=s.id
  left join payouts po on po.policy_id=s.id
  where py.policy_id is not null;
  return v_total;
end;
$function$;
revoke all on function public.partner_app_projected_retention_range(date,date) from public,anon;
grant execute on function public.partner_app_projected_retention_range(date,date) to authenticated,service_role;
