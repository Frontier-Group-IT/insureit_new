begin;

create or replace function public.partner_app_external_renewal_intake_link(p_opportunity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_identity jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  v_scope := public.partner_app_commercial_scope();
  v_identity := public.partner_app_current_identity();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none')='none' or v_identity is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select jsonb_build_object(
    'linked', true,
    'owned', x.owned,
    'intake_id', case when x.owned then x.intake_id else null end,
    'intake_number', case when x.owned then x.intake_number else null end,
    'status', case when x.owned then x.status else null end,
    'final_policy_id', case when x.owned then x.final_policy_id else null end
  )
  into v_result
  from (
    select
      r.id as intake_id,
      r.intake_number,
      r.status,
      r.final_policy_id,
      (
        (coalesce(v_identity->>'actor_kind','')='employee' and r.submitted_by_profile_id=(v_identity->>'profile_id')::uuid)
        or
        (coalesce(v_identity->>'actor_kind','')='intermediary' and r.submitted_by_portal_account_id=(v_identity->>'portal_account_id')::uuid)
      ) as owned
    from public.external_renewal_policy_intake_links l
    join public.policy_intake_requests r on r.id=l.intake_id
    where l.opportunity_id=p_opportunity_id
      and l.partner_id=any(v_partner_ids)
    limit 1
  ) x;

  return v_result;
end;
$$;

revoke all on function public.partner_app_external_renewal_intake_link(uuid) from public, anon;
grant execute on function public.partner_app_external_renewal_intake_link(uuid) to authenticated, service_role;

commit;
