create or replace function public.partner_web_net_premium_this_month()
returns numeric
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_scope jsonb;
  v_identity jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_month_start date := date_trunc('month', current_date)::date;
  v_next_month_start date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_total numeric;
begin
  v_identity := public.partner_app_current_identity();
  v_scope := public.partner_app_commercial_scope();

  if v_identity is null
    or v_scope is null
    or coalesce(v_identity ->> 'actor_kind', '') <> 'intermediary'
  then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode', 'none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'employee_ids', '[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids', '[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'group_ids', '[]'::jsonb)) value;

  select coalesce(sum(ppd.net_premium), 0::numeric)
  into v_total
  from public.policies p
  join public.policy_premium_details ppd on ppd.policy_id = p.id
  left join public.intermediaries i on i.intermediary_code = p.intermediary_code
  where coalesce(p.issuance_date, p.created_at::date) >= v_month_start
    and coalesce(p.issuance_date, p.created_at::date) < v_next_month_start
    and case
      when v_scope_mode = 'none' then false
      when v_actor_kind = 'intermediary' then i.id = any(v_intermediary_ids)
      when v_actor_kind = 'employee' and v_scope_mode = 'organization' then true
      when v_actor_kind = 'employee' then
        p.rm_employee_id = any(v_employee_ids)
        or i.id = any(v_intermediary_ids)
        or (p.intermediary_group_id is not null and p.intermediary_group_id = any(v_group_ids))
      else false
    end;

  return v_total;
end;
$function$;

revoke all on function public.partner_web_net_premium_this_month() from public;
revoke all on function public.partner_web_net_premium_this_month() from anon;
grant execute on function public.partner_web_net_premium_this_month() to authenticated;
grant execute on function public.partner_web_net_premium_this_month() to service_role;

comment on function public.partner_web_net_premium_this_month()
is 'Returns current-month net premium for the authenticated Partner web commercial scope.';
