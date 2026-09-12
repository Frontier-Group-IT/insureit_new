create or replace function public.partner_web_claim_outstanding()
returns numeric
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_result numeric;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode', 'none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids', '[]'::jsonb)) value;

  with scoped_claims as (
    select
      cl.id,
      cl.estimated_loss,
      cl.approved_amount,
      cl.settlement_amount
    from public.claims cl
    join public.customers c on c.id = cl.customer_id
    where lower(coalesce(cl.current_status::text, '')) <> 'claim complete'
      and case
        when v_scope_mode = 'none' then false
        when v_actor_kind = 'employee' and v_scope_mode = 'organization' then true
        else c.lead_source_intermediary_id = any(v_intermediary_ids)
      end
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
  'Returns outstanding value for active claims within the same scoped Partner claim set used by the Partner web claim summary/list. Uses approved amount when available, estimated loss as fallback, less settlement amount, floored at zero.';
