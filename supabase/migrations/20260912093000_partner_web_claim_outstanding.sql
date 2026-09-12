create or replace function public.partner_web_claim_outstanding()
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_scope public.partner_app_commercial_scope_payload;
  v_result numeric;
begin
  v_scope := public.partner_app_commercial_scope();

  if coalesce(v_scope.scope_mode, 'none') = 'none' then
    return 0;
  end if;

  with scoped_claims as (
    select
      c.id,
      c.estimated_loss,
      c.approved_amount,
      c.settlement_amount
    from public.claims c
    cross join lateral public.partner_app_claim_commercial_tuples(c.id) t
    where c.completed_at is null
      and (
        (coalesce(cardinality(v_scope.partner_ids), 0) > 0 and t.partner_id = any(v_scope.partner_ids))
        or
        (coalesce(cardinality(v_scope.employee_ids), 0) > 0 and t.rm_employee_id = any(v_scope.employee_ids))
        or
        (coalesce(cardinality(v_scope.intermediary_ids), 0) > 0 and (
          t.partner_id = any(v_scope.intermediary_ids)
          or t.posp_id = any(v_scope.intermediary_ids)
          or t.misp_id = any(v_scope.intermediary_ids)
        ))
      )
    group by c.id, c.estimated_loss, c.approved_amount, c.settlement_amount
  )
  select coalesce(
    sum(
      greatest(
        coalesce(approved_amount, estimated_loss, 0) - coalesce(settlement_amount, 0),
        0
      )
    ),
    0
  )
  into v_result
  from scoped_claims;

  return coalesce(v_result, 0);
end;
$function$;

revoke all on function public.partner_web_claim_outstanding() from public;
grant execute on function public.partner_web_claim_outstanding() to authenticated;

comment on function public.partner_web_claim_outstanding() is
  'Returns scoped outstanding value for active Partner claims for the Partner web dashboard. Uses approved amount when available, estimated loss as fallback, less settlement amount, floored at zero.';
