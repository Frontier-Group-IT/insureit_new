-- Read-only scoped lookup for Partner customer external-policy claim links.
-- Apply through the normal reviewed migration process BEFORE publishing the app.
create or replace function public.partner_app_customer_external_claim_links(p_customer_id uuid)
returns table(claim_id uuid, external_policy_id uuid)
language plpgsql stable security definer
set search_path = public, auth
as $function$
begin
  if not public.partner_app_customer_in_scope(p_customer_id) then
    raise exception 'Customer is not available in this Partner scope' using errcode = '42501';
  end if;
  return query
  select cl.id, cl.external_policy_id
  from public.claims cl
  join public.external_policies ep on ep.id = cl.external_policy_id
  where cl.customer_id = p_customer_id
    and cl.policy_id is null
    and cl.external_policy_id is not null
    and ep.customer_id = cl.customer_id
    and (cl.vehicle_id is null or ep.vehicle_id = cl.vehicle_id)
    and public.partner_app_claim_in_scope(cl.id)
  order by cl.created_at desc
  limit 25;
end;
$function$;
revoke all on function public.partner_app_customer_external_claim_links(uuid) from public;
grant execute on function public.partner_app_customer_external_claim_links(uuid) to authenticated;
