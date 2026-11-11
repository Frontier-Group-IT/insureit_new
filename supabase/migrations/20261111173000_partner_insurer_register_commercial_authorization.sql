-- INSUREIT Partner insurer register: prevent unrestricted employee Pay-In/Retention exposure.
-- Production migration must be explicitly approved and applied BEFORE the mobile UI OTA.
-- Keep the UUID allowlist synchronized with apps/web-portal/lib/policy-commercial-access.ts.
-- Operations Head Life receives no aggregate commercial grant: individual policy access
-- requires separate record-scoped authorization that this aggregate RPC cannot enforce.
-- Payout remains intermediary-scoped; policy totals/premiums and all existing calculations remain unchanged.
CREATE OR REPLACE FUNCTION public.partner_app_insurer_register_range(p_from_date date, p_to_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_scope jsonb;
  v_actor text;
  v_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_result jsonb;
  v_commercial_allowed boolean := false;
begin
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date or p_to_date - p_from_date > 366 then
    raise exception 'Invalid insurer register date range' using errcode = '22023';
  end if;
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'Partner scope unavailable' using errcode = '28000';
  end if;
  v_actor := v_scope->>'actor_kind';
  v_mode := coalesce(v_scope->>'scope_mode', 'none');
  -- Commercial access follows apps/web-portal/lib/policy-commercial-access.ts.
  -- Aggregate reports cannot prove the case-specific authorization required for
  -- operations_head_life, so that role is denied aggregate Pay-In/Retention.
  select coalesce(p.is_active, false) and p.role::text <> 'operations_head_life' and (
      p.role::text = 'accounts'
      or p.id = any(array[
        '87e3985c-3488-401b-a3bc-5e270c74c759'::uuid,
        '21a8b85f-5051-4fec-8b29-3960163b6d1f'::uuid,
        'dd3a036f-2cca-4a1e-b639-21fc1cc807ef'::uuid,
        '1b7cb2bb-e9a3-4713-ab42-56758dab10c9'::uuid,
        '8c4ec4a2-d940-4394-b484-698e9ab70a69'::uuid,
        'f634d48a-e075-4dbd-849c-3e17974f3f94'::uuid
      ])
    )
    into v_commercial_allowed
    from public.profiles p
    where p.id = auth.uid() and v_actor = 'employee';
  v_commercial_allowed := coalesce(v_commercial_allowed, false);
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_employee_ids
    from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_intermediary_ids
    from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_group_ids
    from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  with scoped_policies as (
    select p.id, p.insurance_company_id,
           coalesce(ppd.net_premium,p.premium_amount,0) as net_premium
    from public.policies p
    left join public.policy_premium_details ppd on ppd.policy_id=p.id
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where coalesce(p.issuance_date,p.created_at::date) between p_from_date and p_to_date
      and case
        when v_mode='none' then false
        when v_actor='intermediary' then i.id=any(v_intermediary_ids)
        when v_actor='employee' and v_mode='organization' then true
        when v_actor='employee' then p.rm_employee_id=any(v_employee_ids)
          or i.id=any(v_intermediary_ids)
          or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
        else false
      end
  ),
  payout_by_policy as (
    select pip.policy_id,
      sum(case when pip.payout_basis is not null then coalesce(pip.partner_payout_amount,0)
               else coalesce(pip.gross_payout,0) end) as payout
    from public.policy_intermediary_payouts pip
    join public.intermediaries i on upper(i.intermediary_code)=upper(pip.intermediary_code)
    join scoped_policies sp on sp.id=pip.policy_id
    where v_actor='intermediary' and i.id=any(v_intermediary_ids)
    group by pip.policy_id
  ),
  payin_by_policy as (
    -- Match partner_app_projected_retention_range: one recorded pay-in per policy.
    select pd.policy_id, max(pd.payin_after_tds) as payin_after_tds
    from public.policy_payin_details pd
    join scoped_policies sp on sp.id=pd.policy_id
    group by pd.policy_id
  ),
  all_payout_by_policy as (
    -- Employee projected retention subtracts all recorded policy payouts.
    select pip.policy_id,
      sum(case when pip.payout_basis is not null then coalesce(pip.partner_payout_amount,0)
               else coalesce(pip.gross_payout,0) end) as payout
    from public.policy_intermediary_payouts pip
    join scoped_policies sp on sp.id=pip.policy_id
    group by pip.policy_id
  ),
  insurer_rows as (
    select ic.name, count(*)::int as policies, coalesce(sum(sp.net_premium),0) as premium,
      case when v_actor='intermediary' then coalesce(sum(coalesce(pb.payout,0)),0) else null end as payout,
      case when v_actor='employee' and v_commercial_allowed then coalesce(sum(py.payin_after_tds),0) else null end as payin,
      case when v_actor='employee' and v_commercial_allowed then coalesce(sum(coalesce(py.payin_after_tds,0)-coalesce(ap.payout,0)) filter (where py.policy_id is not null),0) else null end as retention
    from scoped_policies sp
    join public.insurance_companies ic on ic.id=sp.insurance_company_id
    left join payout_by_policy pb on pb.policy_id=sp.id
    left join payin_by_policy py on py.policy_id=sp.id
    left join all_payout_by_policy ap on ap.policy_id=sp.id
    where nullif(btrim(ic.name),'') is not null
    group by ic.id,ic.name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name',name,'policies',policies,'premium',premium,'payout',payout,
    'payin',payin,'retention',retention
  ) order by premium desc,policies desc,name),'[]'::jsonb)
  into v_result from insurer_rows;
  return v_result;
end;
$function$

