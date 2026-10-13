begin;

-- Read-only, additive Partner insurer ranking.
-- Uses exactly the same commercial-scope predicate and effective premium as
-- partner_app_business_performance(). Never accepts a caller-supplied scope.
create or replace function public.partner_app_top_insurers()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_month_start date := date_trunc('month', current_date)::date;
  v_next_month_start date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode = '28000';
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

  with scoped_policies as (
    select
      p.insurance_company_id,
      coalesce(ppd.gross_premium, p.premium_amount, 0) as effective_premium
    from public.policies p
    left join public.policy_premium_details ppd on ppd.policy_id = p.id
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
      end
  ),
  insurer_rows as (
    select
      ic.name as name,
      count(*)::int as policies,
      coalesce(sum(sp.effective_premium), 0) as premium
    from scoped_policies sp
    join public.insurance_companies ic on ic.id = sp.insurance_company_id
    where nullif(btrim(ic.name), '') is not null
    group by ic.id, ic.name
  )
  select coalesce(jsonb_agg(
    jsonb_build_object('name', name, 'policies', policies, 'premium', premium)
    order by premium desc, policies desc, name
  ), '[]'::jsonb) into v_result
  from insurer_rows;

  return v_result;
end;
$$;

revoke all on function public.partner_app_top_insurers() from public, anon;
grant execute on function public.partner_app_top_insurers() to authenticated, service_role;

commit;
