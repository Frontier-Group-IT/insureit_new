begin;

create or replace function public.apply_motor_flat_partner_payout_v1(
  p_policy_id uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_basis text := upper(coalesce(p_payload #>> '{payin,basis}', ''));
  v_flat_amount numeric := greatest(0, coalesce(nullif(p_payload #>> '{payout,flatAmount}', '')::numeric, 0));
  v_payin_after_tds numeric := 0;
  v_payout_id uuid;
begin
  select coalesce(payin_after_tds, 0)
    into v_payin_after_tds
  from public.policy_payin_details
  where policy_id = p_policy_id;

  select id
    into v_payout_id
  from public.policy_intermediary_payouts
  where policy_id = p_policy_id
  order by created_at desc
  limit 1;

  if v_payout_id is null then
    return;
  end if;

  if v_basis = 'FLAT' then
    update public.policy_intermediary_payouts
    set
      payout_basis = 'FIXED_AMOUNT',
      partner_payout_percent = null,
      partner_payout_amount = v_flat_amount,
      od_payout_percent = 0,
      tp_payout_percent = 0,
      od_payout_amount = 0,
      tp_payout_amount = 0,
      gross_payout = v_flat_amount,
      retention_amount = v_payin_after_tds - v_flat_amount,
      calculation_version = 'motor_flat_payout_v1',
      updated_at = now()
    where id = v_payout_id;
  else
    update public.policy_intermediary_payouts
    set
      payout_basis = null,
      partner_payout_percent = null,
      partner_payout_amount = null,
      updated_at = now()
    where id = v_payout_id
      and payout_basis = 'FIXED_AMOUNT';
  end if;
end;
$$;

revoke all on function public.apply_motor_flat_partner_payout_v1(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.apply_motor_flat_partner_payout_v1(uuid,jsonb) to postgres, service_role;

create or replace function public.onboard_motor_policy_commercial_status_v2(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_policy_id uuid;
  v_payin_provided boolean := coalesce((p_payload #>> '{payin,provided}')::boolean, false);
  v_payout_provided boolean := coalesce((p_payload #>> '{payout,provided}')::boolean, false);
begin
  v_result := public.onboard_motor_policy(p_payload);
  v_policy_id := nullif(v_result ->> 'policyId', '')::uuid;

  if v_policy_id is null then
    raise exception 'Motor policy onboarding did not return a policy id.';
  end if;

  perform public.apply_motor_flat_partner_payout_v1(v_policy_id, p_payload);

  update public.policy_payin_details
  set
    commercial_status = case when v_payin_provided then 'entered' else 'needs_review' end,
    commercial_reviewed_at = null,
    commercial_reviewed_by = null,
    updated_at = now()
  where policy_id = v_policy_id;

  update public.policy_intermediary_payouts
  set
    commercial_status = case when v_payout_provided then 'entered' else 'needs_review' end,
    commercial_reviewed_at = null,
    commercial_reviewed_by = null,
    updated_at = now()
  where id = (
    select id
    from public.policy_intermediary_payouts
    where policy_id = v_policy_id
    order by created_at desc
    limit 1
  );

  return v_result;
end;
$$;

create or replace function public.update_motor_policy_commercial_status_v2(
  p_policy_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_payin_provided boolean := coalesce((p_payload #>> '{payin,provided}')::boolean, false);
  v_payout_provided boolean := coalesce((p_payload #>> '{payout,provided}')::boolean, false);

  v_old_payin_status text;
  v_old_payin_reviewed_at timestamptz;
  v_old_payin_reviewed_by uuid;
  v_old_payin_od numeric;
  v_old_payin_tp numeric;
  v_old_payin_scheme numeric;
  v_old_payin_total numeric;

  v_old_payout_id uuid;
  v_old_payout_status text;
  v_old_payout_reviewed_at timestamptz;
  v_old_payout_reviewed_by uuid;
  v_old_payout_od numeric;
  v_old_payout_tp numeric;
  v_old_payout_total numeric;
  v_old_payout_basis text;
  v_old_payout_fixed numeric;

  v_new_payin_od numeric;
  v_new_payin_tp numeric;
  v_new_payin_scheme numeric;
  v_new_payin_total numeric;

  v_new_payout_id uuid;
  v_new_payout_od numeric;
  v_new_payout_tp numeric;
  v_new_payout_total numeric;
  v_new_payout_basis text;
  v_new_payout_fixed numeric;

  v_payin_changed boolean;
  v_payout_changed boolean;
begin
  select
    commercial_status,
    commercial_reviewed_at,
    commercial_reviewed_by,
    projected_od_percent,
    projected_tp_percent,
    insurer_scheme_amount,
    total_projected_payin
  into
    v_old_payin_status,
    v_old_payin_reviewed_at,
    v_old_payin_reviewed_by,
    v_old_payin_od,
    v_old_payin_tp,
    v_old_payin_scheme,
    v_old_payin_total
  from public.policy_payin_details
  where policy_id = p_policy_id;

  select
    id,
    commercial_status,
    commercial_reviewed_at,
    commercial_reviewed_by,
    od_payout_percent,
    tp_payout_percent,
    gross_payout,
    payout_basis,
    partner_payout_amount
  into
    v_old_payout_id,
    v_old_payout_status,
    v_old_payout_reviewed_at,
    v_old_payout_reviewed_by,
    v_old_payout_od,
    v_old_payout_tp,
    v_old_payout_total,
    v_old_payout_basis,
    v_old_payout_fixed
  from public.policy_intermediary_payouts
  where policy_id = p_policy_id
  order by created_at desc
  limit 1;

  v_result := public.update_motor_policy(p_policy_id, p_payload);

  perform public.apply_motor_flat_partner_payout_v1(p_policy_id, p_payload);

  select
    projected_od_percent,
    projected_tp_percent,
    insurer_scheme_amount,
    total_projected_payin
  into
    v_new_payin_od,
    v_new_payin_tp,
    v_new_payin_scheme,
    v_new_payin_total
  from public.policy_payin_details
  where policy_id = p_policy_id;

  select
    id,
    od_payout_percent,
    tp_payout_percent,
    gross_payout,
    payout_basis,
    partner_payout_amount
  into
    v_new_payout_id,
    v_new_payout_od,
    v_new_payout_tp,
    v_new_payout_total,
    v_new_payout_basis,
    v_new_payout_fixed
  from public.policy_intermediary_payouts
  where policy_id = p_policy_id
  order by created_at desc
  limit 1;

  v_payin_changed :=
    v_old_payin_status is null
    or coalesce(v_old_payin_od, 0) <> coalesce(v_new_payin_od, 0)
    or coalesce(v_old_payin_tp, 0) <> coalesce(v_new_payin_tp, 0)
    or coalesce(v_old_payin_scheme, 0) <> coalesce(v_new_payin_scheme, 0)
    or abs(coalesce(v_old_payin_total, 0) - coalesce(v_new_payin_total, 0)) > 0.01;

  v_payout_changed :=
    v_old_payout_id is null
    or coalesce(v_old_payout_od, 0) <> coalesce(v_new_payout_od, 0)
    or coalesce(v_old_payout_tp, 0) <> coalesce(v_new_payout_tp, 0)
    or abs(coalesce(v_old_payout_total, 0) - coalesce(v_new_payout_total, 0)) > 0.01
    or v_old_payout_basis is distinct from v_new_payout_basis
    or abs(coalesce(v_old_payout_fixed, 0) - coalesce(v_new_payout_fixed, 0)) > 0.01;

  update public.policy_payin_details
  set
    commercial_status = case
      when not v_payin_changed and v_old_payin_status in ('entered','reviewed','not_applicable') then v_old_payin_status
      when not v_payin_changed and v_old_payin_status = 'needs_review' and v_payin_provided then 'entered'
      when not v_payin_changed and v_old_payin_status = 'needs_review' then 'needs_review'
      when v_old_payin_status = 'reviewed' and v_payin_changed then 'needs_review'
      when v_payin_provided then 'entered'
      else 'needs_review'
    end,
    commercial_reviewed_at = case when not v_payin_changed then v_old_payin_reviewed_at else null end,
    commercial_reviewed_by = case when not v_payin_changed then v_old_payin_reviewed_by else null end,
    updated_at = now()
  where policy_id = p_policy_id;

  if v_new_payout_id is not null then
    update public.policy_intermediary_payouts
    set
      commercial_status = case
        when not v_payout_changed and v_old_payout_status in ('entered','reviewed','not_applicable') then v_old_payout_status
        when not v_payout_changed and v_old_payout_status = 'needs_review' and v_payout_provided then 'entered'
        when not v_payout_changed and v_old_payout_status = 'needs_review' then 'needs_review'
        when v_old_payout_status = 'reviewed' and v_payout_changed then 'needs_review'
        when v_payout_provided then 'entered'
        else 'needs_review'
      end,
      commercial_reviewed_at = case when not v_payout_changed then v_old_payout_reviewed_at else null end,
      commercial_reviewed_by = case when not v_payout_changed then v_old_payout_reviewed_by else null end,
      updated_at = now()
    where id = v_new_payout_id;
  end if;

  return v_result;
end;
$$;

revoke all on function public.onboard_motor_policy_commercial_status_v2(jsonb) from public, anon, authenticated;
grant execute on function public.onboard_motor_policy_commercial_status_v2(jsonb) to postgres, service_role;

revoke all on function public.update_motor_policy_commercial_status_v2(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_motor_policy_commercial_status_v2(uuid, jsonb) to postgres, service_role;

comment on function public.apply_motor_flat_partner_payout_v1(uuid,jsonb)
is 'Applies Motor FLAT partner payout using the existing fixed-amount payout columns without changing NET/OD formulas.';

comment on function public.onboard_motor_policy_commercial_status_v2(jsonb)
is 'Motor onboarding wrapper that preserves explicit zero commercial entries and supports FLAT partner payout.';

comment on function public.update_motor_policy_commercial_status_v2(uuid,jsonb)
is 'Motor edit wrapper that preserves reviewed status when unchanged, reopens changed commercials safely, and supports FLAT partner payout.';

commit;
