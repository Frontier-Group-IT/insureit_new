-- Partner-only payout overview for all permitted Partner/Associate/Group/Branch scopes.
-- Totals are restricted to intermediary IDs provided by the server-side commercial scope.
create or replace function public.partner_app_scoped_payout_range(
  p_from_date date,
  p_to_date date
) returns numeric
language plpgsql stable security definer
set search_path = public, auth
as $function$
declare
  v_scope jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_total numeric;
begin
  if p_from_date is null or p_to_date is null or p_from_date > p_to_date then
    raise exception 'Invalid payout date range' using errcode = '22023';
  end if;
  if p_to_date - p_from_date > 366 then
    raise exception 'Payout date range is too large' using errcode = '22023';
  end if;
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'Partner scope unavailable' using errcode = '28000';
  end if;
  if v_scope ->> 'actor_kind' <> 'intermediary' then
    return null;
  end if;
  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids', '[]'::jsonb)) value;

  select coalesce(sum(case
    when pip.payout_basis is not null then coalesce(pip.partner_payout_amount, 0)
    else coalesce(pip.gross_payout, 0)
  end), 0)
  into v_total
  from public.policy_intermediary_payouts pip
  join public.policies p on p.id = pip.policy_id
  join public.intermediaries i on upper(i.intermediary_code) = upper(pip.intermediary_code)
  where i.id = any(v_ids)
    and coalesce(p.issuance_date, p.created_at::date) between p_from_date and p_to_date;

  return v_total;
end;
$function$;
revoke all on function public.partner_app_scoped_payout_range(date,date) from public, anon;
grant execute on function public.partner_app_scoped_payout_range(date,date) to authenticated, service_role;
