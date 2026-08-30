-- Preserve intentional zero commercial entries and keep Commercial Control status consistent.
-- New wrapper RPCs call the existing Motor onboarding/update functions transactionally,
-- then reconcile commercial_status based on explicit user-provided intent.
-- Existing legacy RPCs remain untouched for rollback safety.

begin;

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

  v_new_payin_od numeric;
  v_new_payin_tp numeric;
  v_new_payin_scheme numeric;
  v_new_payin_total numeric;

  v_new_payout_id uuid;
  v_new_payout_od numeric;
  v_new_payout_tp numeric;
  v_new_payout_total numeric;

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
    gross_payout
  into
    v_old_payout_id,
    v_old_payout_status,
    v_old_payout_reviewed_at,
    v_old_payout_reviewed_by,
    v_old_payout_od,
    v_old_payout_tp,
    v_old_payout_total
  from public.policy_intermediary_payouts
  where policy_id = p_policy_id
  order by created_at desc
  limit 1;

  v_result := public.update_motor_policy(p_policy_id, p_payload);

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
    gross_payout
  into
    v_new_payout_id,
    v_new_payout_od,
    v_new_payout_tp,
    v_new_payout_total
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
    or abs(coalesce(v_old_payout_total, 0) - coalesce(v_new_payout_total, 0)) > 0.01;

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
    commercial_reviewed_at = case
      when not v_payin_changed then v_old_payin_reviewed_at
      else null
    end,
    commercial_reviewed_by = case
      when not v_payin_changed then v_old_payin_reviewed_by
      else null
    end,
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
      commercial_reviewed_at = case
        when not v_payout_changed then v_old_payout_reviewed_at
        else null
      end,
      commercial_reviewed_by = case
        when not v_payout_changed then v_old_payout_reviewed_by
        else null
      end,
      updated_at = now()
    where id = v_new_payout_id;
  end if;

  return v_result;
end;
$$;

-- Repair only rows that are provably populated. Historical all-zero rows are
-- intentionally left untouched because older data cannot distinguish blank defaults
-- from an explicit user-entered zero.
update public.policy_payin_details
set
  commercial_status = 'entered',
  updated_at = now()
where commercial_status = 'needs_review'
  and (
    coalesce(projected_od_percent, 0) <> 0
    or coalesce(projected_tp_percent, 0) <> 0
    or coalesce(insurer_scheme_amount, 0) <> 0
    or coalesce(total_projected_payin, 0) <> 0
  );

update public.policy_intermediary_payouts
set
  commercial_status = 'entered',
  updated_at = now()
where commercial_status = 'needs_review'
  and (
    coalesce(od_payout_percent, 0) <> 0
    or coalesce(tp_payout_percent, 0) <> 0
    or coalesce(partner_payout_amount, 0) <> 0
    or coalesce(gross_payout, 0) <> 0
  );

revoke all on function public.onboard_motor_policy_commercial_status_v2(jsonb) from public, anon, authenticated;
grant execute on function public.onboard_motor_policy_commercial_status_v2(jsonb) to postgres, service_role;

revoke all on function public.update_motor_policy_commercial_status_v2(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_motor_policy_commercial_status_v2(uuid, jsonb) to postgres, service_role;

comment on function public.onboard_motor_policy_commercial_status_v2(jsonb)
is 'Motor onboarding wrapper that preserves explicit zero Pay-In/Payout entries as entered.';

comment on function public.update_motor_policy_commercial_status_v2(uuid, jsonb)
is 'Motor edit wrapper that preserves reviewed status when unchanged and reopens changed commercials safely.';

commit;
