-- Scoped, read-only master-name lookup for the Partner Policy Details card.
-- Does not alter policies, intermediary codes, master records, or existing policy-detail RPC.
create or replace function public.partner_app_policy_intermediary_name(p_policy_id uuid)
returns text
language plpgsql stable security definer
set search_path = public, auth
as $$
declare
  v_code text;
  v_name text;
begin
  if auth.uid() is null or not public.partner_app_policy_in_scope(p_policy_id) then
    raise exception 'Policy is not available in your Partner scope' using errcode = '42501';
  end if;
  select nullif(btrim(p.intermediary_code), '') into v_code
  from public.policies p where p.id = p_policy_id;
  if v_code is null then return null; end if;
  select coalesce(nullif(btrim(i.display_name), ''), nullif(btrim(i.legal_name), ''))
  into v_name from public.intermediaries i where i.intermediary_code = v_code
  order by i.created_at desc limit 1;
  if v_name is null then
    select coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(p.legal_name), ''))
    into v_name from public.partners p where p.partner_code = v_code
    order by p.created_at desc limit 1;
  end if;
  return v_name;
end;
$$;
revoke all on function public.partner_app_policy_intermediary_name(uuid) from public, anon;
grant execute on function public.partner_app_policy_intermediary_name(uuid) to authenticated;
