-- Server-side business-line filter for Partner Policies. Retains authenticated scope,
-- lifecycle, search, exact total_count and paging, without replacing the old RPC.
-- Apply before publishing the Partner App update that calls the new RPC.
BEGIN;
CREATE OR REPLACE FUNCTION public.partner_app_list_policies_by_line(p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text, p_lifecycle text DEFAULT 'all'::text, p_business_line text DEFAULT 'all'::text)
 RETURNS TABLE(policy_id uuid, policy_code text, policy_no text, policy_type text, policy_product text, business_line text, business_type text, start_date date, end_date date, issuance_date date, premium_amount numeric, policy_status text, lifecycle_status text, customer_id uuid, customer_name text, vehicle_id uuid, vehicle_no text, insurer_name text, intermediary_type text, intermediary_code text, rm_name text, intermediary_group_code text, intermediary_group_name text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_scope jsonb;
  v_is_branch_login boolean := false;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_partner_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_limit integer := greatest(1,least(coalesce(p_limit,25),100));
  v_offset integer := greatest(0,least(coalesce(p_offset,0),100000));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_lifecycle text := lower(coalesce(nullif(btrim(p_lifecycle),''),'all'));
  v_line text := lower(coalesce(nullif(btrim(p_business_line),''),'all'));
begin
  if v_lifecycle not in ('all','in_force','expiring','expired','upcoming') then
    raise exception 'Invalid policy lifecycle filter';
  end if;
  if v_line not in ('all','motor','non motor','life','health') then
    raise exception 'Invalid policy business line filter';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  -- Canonical-only Branch identity is never allowed to inherit parent Partner scope.
  v_is_branch_login := exists (
    select 1 from public.portal_access_identities a
    where a.profile_id=auth.uid() and a.entity_type='branch'
  ) or exists (
    select 1 from public.partner_branch_login_links l where l.profile_id=auth.uid()
  );

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  return query
  with base as (
    select
      p.id as policy_id,
      p.policy_code,
      p.policy_no,
      p.policy_type,
      p.policy_product,
      p.business_line,
      p.business_type,
      p.start_date,
      p.end_date,
      p.issuance_date,
      coalesce(prem.gross_premium,p.premium_amount,0) as premium_amount,
      p.status as policy_status,
      p.customer_id,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      p.vehicle_id,
      v.vehicle_no,
      ic.name as insurer_name,
      p.intermediary_type,
      p.intermediary_code,
      p.rm_name,
      p.intermediary_group_code,
      p.intermediary_group_name,
      p.created_at,
      i.id as intermediary_id,
      case
        when p.end_date is not null and p.end_date<current_date then 'expired'
        when p.start_date is not null and p.start_date>current_date then 'upcoming'
        when p.end_date between current_date and current_date+30 then 'expiring'
        else 'in_force'
      end as lifecycle_status
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join public.customers c on c.id=p.customer_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    left join lateral (
      select ppd.gross_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where case
      when v_is_branch_login then exists (
        select 1 from public.partner_branch_authorized_policy_ids() authorized
        where authorized.policy_id=p.id
      )
      when v_scope_mode='none' then false
      when v_actor_kind='intermediary' then (i.id=any(v_intermediary_ids) or exists (select 1 from public.partners scoped_partner where scoped_partner.id=any(v_partner_ids) and scoped_partner.partner_code=p.intermediary_code))
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      when v_actor_kind='employee' then
        p.rm_employee_id=any(v_employee_ids)
        or i.id=any(v_intermediary_ids)
        or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
      else false
    end
  ),
  filtered as (
    select b.*
    from base b
    where
      (v_lifecycle='all' or b.lifecycle_status=v_lifecycle)
      and (v_line='all' or
        (case
          when concat_ws(' ',b.policy_type,b.policy_product,b.business_line) ilike '%health%' then 'health'
          when concat_ws(' ',b.policy_type,b.policy_product,b.business_line) ilike '%life%' then 'life'
          when concat_ws(' ',b.policy_type,b.policy_product,b.business_line) ilike '%motor%' or b.vehicle_id is not null or b.vehicle_no is not null then 'motor'
          else 'non motor'
        end)=v_line)
      and (
        v_search is null
        or b.policy_no ilike '%'||v_search||'%'
        or b.policy_code ilike '%'||v_search||'%'
        or b.customer_name ilike '%'||v_search||'%'
        or b.vehicle_no ilike '%'||v_search||'%'
        or b.insurer_name ilike '%'||v_search||'%'
        or b.intermediary_code ilike '%'||v_search||'%'
      )
  )
  select
    f.policy_id,
    f.policy_code,
    f.policy_no,
    f.policy_type,
    f.policy_product,
    f.business_line,
    f.business_type,
    f.start_date,
    f.end_date,
    f.issuance_date,
    f.premium_amount,
    f.policy_status,
    f.lifecycle_status,
    f.customer_id,
    f.customer_name,
    f.vehicle_id,
    f.vehicle_no,
    f.insurer_name,
    f.intermediary_type,
    f.intermediary_code,
    f.rm_name,
    f.intermediary_group_code,
    f.intermediary_group_name,
    count(*) over() as total_count
  from filtered f
  order by coalesce(f.issuance_date,f.start_date,f.created_at::date) desc,f.created_at desc
  limit v_limit offset v_offset;
end;
$function$
;


REVOKE ALL ON FUNCTION public.partner_app_list_policies_by_line(integer, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_app_list_policies_by_line(integer, integer, text, text, text) TO authenticated, service_role;
COMMIT;
