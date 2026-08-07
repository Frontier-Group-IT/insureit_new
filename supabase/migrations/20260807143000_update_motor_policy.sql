-- Atomic update path for the current six-section motor policy editor.
-- Customer and vehicle master identities are intentionally not changed here.

create or replace function public.update_motor_policy(
  p_policy_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_policy public.policies%rowtype;
  v_vehicle_class text;
  v_od numeric := coalesce(nullif(p_payload #>> '{premium,od}', '')::numeric, 0);
  v_tp numeric := coalesce(nullif(p_payload #>> '{premium,tp}', '')::numeric, 0);
  v_cpa_opted boolean := coalesce((p_payload #>> '{premium,cpaOpted}')::boolean, false);
  v_cpa numeric := coalesce(nullif(p_payload #>> '{premium,cpa}', '')::numeric, 0);
  v_idv numeric := coalesce(nullif(p_payload #>> '{policy,idv}', '')::numeric, 0);
  v_net numeric;
  v_gst numeric;
  v_gross numeric;
  v_projected_od_percent numeric := coalesce(nullif(p_payload #>> '{payin,odPercent}', '')::numeric, 0);
  v_projected_tp_percent numeric := coalesce(nullif(p_payload #>> '{payin,tpPercent}', '')::numeric, 0);
  v_scheme numeric := coalesce(nullif(p_payload #>> '{payin,scheme}', '')::numeric, 0);
  v_projected_od numeric;
  v_projected_tp numeric;
  v_total_payin numeric;
  v_tds numeric;
  v_payin_after_tds numeric;
  v_retention numeric := coalesce(nullif(p_payload #>> '{payout,retention}', '')::numeric, 0);
  v_payout_od_percent numeric := coalesce(nullif(p_payload #>> '{payout,odPercent}', '')::numeric, 0);
  v_payout_tp_percent numeric := coalesce(nullif(p_payload #>> '{payout,tpPercent}', '')::numeric, 0);
  v_payout_od numeric;
  v_payout_tp numeric;
  v_gross_payout numeric;
  v_payout_basis text := coalesce(nullif(p_payload #>> '{payin,basis}', ''), 'NET');
  v_existing_payout_id uuid;
begin
  select * into v_policy
  from public.policies
  where id = p_policy_id
  for update;

  if not found then
    raise exception 'Policy not found.';
  end if;

  if coalesce(nullif(trim(p_payload #>> '{policy,policyNumber}'), ''), '') = '' then
    raise exception 'Policy number is required.';
  end if;
  if coalesce(nullif(trim(p_payload #>> '{policy,policyType}'), ''), '') = '' then
    raise exception 'Policy product is required.';
  end if;
  if coalesce(nullif(trim(p_payload #>> '{policy,insuranceCompanyId}'), ''), '') = '' then
    raise exception 'Insurance company is required.';
  end if;
  if (p_payload #>> '{policy,validFrom}') is null or (p_payload #>> '{policy,validUpto}') is null then
    raise exception 'Policy validity dates are required.';
  end if;
  if (p_payload #>> '{policy,validUpto}') < (p_payload #>> '{policy,validFrom}') then
    raise exception 'Policy Valid Upto cannot be before Valid From.';
  end if;

  select coalesce(vehicle_class_code, vehicle_type)
  into v_vehicle_class
  from public.vehicles
  where id = v_policy.vehicle_id;

  if not v_cpa_opted then
    v_cpa := 0;
  end if;

  v_net := v_od + v_tp + v_cpa;
  if v_vehicle_class = 'GCV' then
    v_gst := ((v_od + v_cpa) * 0.18) + (v_tp * 0.05);
  else
    v_gst := v_net * 0.18;
  end if;
  v_gross := v_net + v_gst;

  v_projected_od := v_od * v_projected_od_percent / 100;
  v_projected_tp := v_tp * v_projected_tp_percent / 100;
  v_total_payin := v_projected_od + v_projected_tp + v_scheme;
  v_tds := v_total_payin * 0.10;
  v_payin_after_tds := v_total_payin - v_tds;

  v_payout_od := v_od * v_payout_od_percent / 100;
  v_payout_tp := case when upper(v_payout_basis) = 'OD' then 0 else v_tp * v_payout_tp_percent / 100 end;
  v_gross_payout := greatest(0, v_payout_od + v_payout_tp - v_retention);

  update public.policies
  set insurance_company_id = (p_payload #>> '{policy,insuranceCompanyId}')::uuid,
      policy_no = trim(p_payload #>> '{policy,policyNumber}'),
      policy_no_normalized = upper(regexp_replace(trim(p_payload #>> '{policy,policyNumber}'), '[^A-Za-z0-9]', '', 'g')),
      policy_type = trim(p_payload #>> '{policy,policyType}'),
      insured_declared_value = v_idv,
      start_date = (p_payload #>> '{policy,validFrom}')::date,
      end_date = (p_payload #>> '{policy,validUpto}')::date,
      issuance_date = nullif(p_payload #>> '{policy,issuanceDate}', '')::date,
      rm_name = nullif(trim(p_payload #>> '{policy,rmName}'), ''),
      intermediary_type = nullif(trim(p_payload #>> '{policy,intermediaryType}'), ''),
      intermediary_code = nullif(trim(p_payload #>> '{policy,intermediaryCode}'), ''),
      lead_source = nullif(trim(p_payload #>> '{policy,leadSource}'), ''),
      business_line = coalesce(nullif(trim(p_payload #>> '{policy,businessLine}'), ''), business_line),
      remarks = nullif(trim(p_payload #>> '{policy,remarks}'), ''),
      calculation_version = 'prototype_v1',
      updated_at = now()
  where id = p_policy_id;

  insert into public.policy_premium_details (
    policy_id, od_premium, tp_premium, cpa_opted, cpa_amount,
    net_premium, gst_amount, gross_premium, gst_rule,
    calculation_version, calculation_overridden, updated_at
  ) values (
    p_policy_id, v_od, v_tp, v_cpa_opted, v_cpa,
    v_net, v_gst, v_gross,
    case when v_vehicle_class = 'GCV' then '18% OD + CPA; 5% TP' else '18% on Net' end,
    'prototype_v1', false, now()
  )
  on conflict (policy_id) do update
  set od_premium = excluded.od_premium,
      tp_premium = excluded.tp_premium,
      cpa_opted = excluded.cpa_opted,
      cpa_amount = excluded.cpa_amount,
      net_premium = excluded.net_premium,
      gst_amount = excluded.gst_amount,
      gross_premium = excluded.gross_premium,
      gst_rule = excluded.gst_rule,
      calculation_version = excluded.calculation_version,
      calculation_overridden = false,
      override_reason = null,
      updated_at = now();

  insert into public.policy_payin_details (
    policy_id, payout_basis,
    projected_od_percent, projected_od_amount,
    projected_tp_percent, projected_tp_amount,
    insurer_scheme_amount, total_projected_payin,
    tds_percent, tds_amount, payin_after_tds,
    calculation_version, updated_at
  ) values (
    p_policy_id, v_payout_basis,
    v_projected_od_percent, v_projected_od,
    v_projected_tp_percent, v_projected_tp,
    v_scheme, v_total_payin,
    10, v_tds, v_payin_after_tds,
    'prototype_v1', now()
  )
  on conflict (policy_id) do update
  set payout_basis = excluded.payout_basis,
      projected_od_percent = excluded.projected_od_percent,
      projected_od_amount = excluded.projected_od_amount,
      projected_tp_percent = excluded.projected_tp_percent,
      projected_tp_amount = excluded.projected_tp_amount,
      insurer_scheme_amount = excluded.insurer_scheme_amount,
      total_projected_payin = excluded.total_projected_payin,
      tds_percent = excluded.tds_percent,
      tds_amount = excluded.tds_amount,
      payin_after_tds = excluded.payin_after_tds,
      calculation_version = excluded.calculation_version,
      updated_at = now();

  select id into v_existing_payout_id
  from public.policy_intermediary_payouts
  where policy_id = p_policy_id
  order by created_at desc
  limit 1
  for update;

  if v_existing_payout_id is null then
    insert into public.policy_intermediary_payouts (
      policy_id, intermediary_type, intermediary_code,
      retention_amount, od_payout_percent, od_payout_amount,
      tp_payout_percent, tp_payout_amount, gross_payout,
      status, payout_date, voucher_number, remarks,
      calculation_version, updated_at
    ) values (
      p_policy_id,
      nullif(trim(p_payload #>> '{policy,intermediaryType}'), ''),
      nullif(trim(p_payload #>> '{policy,intermediaryCode}'), ''),
      v_retention, v_payout_od_percent, v_payout_od,
      v_payout_tp_percent, v_payout_tp, v_gross_payout,
      coalesce(nullif(trim(p_payload #>> '{payout,status}'), ''), 'Pending'),
      nullif(p_payload #>> '{payout,date}', '')::date,
      nullif(trim(p_payload #>> '{payout,voucherNumber}'), ''),
      nullif(trim(p_payload #>> '{policy,remarks}'), ''),
      'prototype_v1', now()
    );
  else
    update public.policy_intermediary_payouts
    set intermediary_type = nullif(trim(p_payload #>> '{policy,intermediaryType}'), ''),
        intermediary_code = nullif(trim(p_payload #>> '{policy,intermediaryCode}'), ''),
        retention_amount = v_retention,
        od_payout_percent = v_payout_od_percent,
        od_payout_amount = v_payout_od,
        tp_payout_percent = v_payout_tp_percent,
        tp_payout_amount = v_payout_tp,
        gross_payout = v_gross_payout,
        status = coalesce(nullif(trim(p_payload #>> '{payout,status}'), ''), status),
        payout_date = nullif(p_payload #>> '{payout,date}', '')::date,
        voucher_number = nullif(trim(p_payload #>> '{payout,voucherNumber}'), ''),
        remarks = nullif(trim(p_payload #>> '{policy,remarks}'), ''),
        calculation_version = 'prototype_v1',
        updated_at = now()
    where id = v_existing_payout_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'policyId', p_policy_id,
    'policyCode', v_policy.policy_code,
    'netPremium', v_net,
    'gstAmount', v_gst,
    'grossPremium', v_gross,
    'payinAfterTds', v_payin_after_tds,
    'grossPayout', v_gross_payout
  );
end;
$$;

revoke all on function public.update_motor_policy(uuid, jsonb) from public;
grant execute on function public.update_motor_policy(uuid, jsonb) to authenticated;
