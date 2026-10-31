-- Guarded repair: Branch PT00110's eight completed intakes stored under parent PT00109.
-- No policies, intermediary codes, premiums, payout or customer rows are modified.
-- The login identity is a legacy Partner ID, resolved to canonical Branch via legacy profile.
BEGIN;
DO $guard$
DECLARE v_branch uuid := '14ff0d5d-b37b-4b63-962c-1977c11def20';
  v_parent uuid := '6d625b81-d3d2-4d77-825b-57c1f58ed350';
  v_profile uuid := 'e09c48fc-9c94-4603-88dd-7ce8b3fe33a1';
  v_matched integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.partner_branches b JOIN public.partner_branch_profiles old ON old.id=b.legacy_branch_profile_id
    JOIN public.partners legacy ON legacy.id=old.partner_id
    JOIN public.portal_access_identities a ON a.entity_id=legacy.id AND a.profile_id=v_profile AND a.entity_type='branch' AND a.status='active'
    WHERE b.id=v_branch AND b.parent_partner_id=v_parent AND b.status='active' AND legacy.partner_code='PT00110' AND legacy.parent_partner_id=v_parent)
  THEN RAISE EXCEPTION 'Branch ownership identity changed: refusing backfill'; END IF;
  WITH expected(policy_id) AS (VALUES
  ('8fd67072-eaa6-4535-a84d-f84667224bb4'::uuid),
  ('dc9c84a2-c052-4e60-bb51-028ef498e61d'::uuid),
  ('7eb95357-809c-4adc-833c-3a82f7f7d4b6'::uuid),
  ('6ba8ea9b-61b4-40be-af70-b1a5b359999e'::uuid),
  ('03164fb5-d009-4c26-9ad2-d5e96240ec85'::uuid),
  ('d6acab8a-96ac-47a5-804e-a8e2b760ac4c'::uuid),
  ('97695a96-7a12-4f3e-9c2e-0b27303c50db'::uuid),
  ('cd8a6b93-8d11-4884-96f5-d0f8baf97f32'::uuid)
  )
  SELECT count(*) INTO v_matched FROM expected e JOIN public.policy_intake_requests i ON i.final_policy_id=e.policy_id
    JOIN public.policies p ON p.id=e.policy_id
    WHERE i.status='completed' AND i.submitted_by_profile_id=v_profile AND p.intermediary_code='PT00109'
      AND NOT EXISTS (SELECT 1 FROM public.partner_branch_policy_links l WHERE l.policy_id=e.policy_id AND l.branch_id<>v_branch);
  IF v_matched<>8 THEN RAISE EXCEPTION 'Expected 8 verified completed policies; got %',v_matched; END IF;
  WITH expected(policy_id) AS (VALUES
  ('8fd67072-eaa6-4535-a84d-f84667224bb4'::uuid),
  ('dc9c84a2-c052-4e60-bb51-028ef498e61d'::uuid),
  ('7eb95357-809c-4adc-833c-3a82f7f7d4b6'::uuid),
  ('6ba8ea9b-61b4-40be-af70-b1a5b359999e'::uuid),
  ('03164fb5-d009-4c26-9ad2-d5e96240ec85'::uuid),
  ('d6acab8a-96ac-47a5-804e-a8e2b760ac4c'::uuid),
  ('97695a96-7a12-4f3e-9c2e-0b27303c50db'::uuid),
  ('cd8a6b93-8d11-4884-96f5-d0f8baf97f32'::uuid)
  )
  INSERT INTO public.partner_branch_policy_links (policy_id,branch_id,parent_partner_id,legacy_intermediary_code)
    SELECT e.policy_id,v_branch,v_parent,p.intermediary_code FROM expected e JOIN public.policies p ON p.id=e.policy_id
    ON CONFLICT (policy_id) DO NOTHING;
  IF (SELECT count(*) FROM public.partner_branch_policy_links WHERE branch_id=v_branch AND policy_id IN (SELECT policy_id FROM (VALUES ('8fd67072-eaa6-4535-a84d-f84667224bb4'::uuid),('dc9c84a2-c052-4e60-bb51-028ef498e61d'::uuid),('7eb95357-809c-4adc-833c-3a82f7f7d4b6'::uuid),('6ba8ea9b-61b4-40be-af70-b1a5b359999e'::uuid),('03164fb5-d009-4c26-9ad2-d5e96240ec85'::uuid),('d6acab8a-96ac-47a5-804e-a8e2b760ac4c'::uuid),('97695a96-7a12-4f3e-9c2e-0b27303c50db'::uuid),('cd8a6b93-8d11-4884-96f5-d0f8baf97f32'::uuid)) selected(policy_id)))<>8
  THEN RAISE EXCEPTION 'Backfill failed to establish all eight Branch links'; END IF;
END $guard$;
COMMIT;

-- Branch-only register and summary now use the same canonical policy ID authorization as Home.
-- Add policies attributed to explicitly authorized Partner IDs, including branch child Partner IDs.
-- Do not widen access based on untrusted branch names.

CREATE OR REPLACE FUNCTION public.partner_app_list_policies(p_limit integer DEFAULT 25, p_offset integer DEFAULT 0, p_search text DEFAULT NULL::text, p_lifecycle text DEFAULT 'all'::text)
 RETURNS TABLE(policy_id uuid, policy_code text, policy_no text, policy_type text, policy_product text, business_line text, business_type text, start_date date, end_date date, issuance_date date, premium_amount numeric, policy_status text, lifecycle_status text, customer_id uuid, customer_name text, vehicle_id uuid, vehicle_no text, insurer_name text, intermediary_type text, intermediary_code text, rm_name text, intermediary_group_code text, intermediary_group_name text, total_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_scope jsonb;
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
begin
  if v_lifecycle not in ('all','in_force','expiring','expired','upcoming') then
    raise exception 'Invalid policy lifecycle filter';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

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
      when v_scope_mode='none' then false
      when v_actor_kind='intermediary' and v_scope->>'portal_access_type'='branch' then p.id in (select allowed.policy_id from public.partner_branch_authorized_policy_ids() allowed)
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

CREATE OR REPLACE FUNCTION public.partner_app_policy_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_partner_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

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

  with scoped_policies as (
    select
      p.*,
      coalesce(prem.gross_premium,p.premium_amount,0) as effective_premium
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join lateral (
      select ppd.gross_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where case
      when v_scope_mode='none' then false
      when v_actor_kind='intermediary' and v_scope->>'portal_access_type'='branch' then p.id in (select allowed.policy_id from public.partner_branch_authorized_policy_ids() allowed)
      when v_actor_kind='intermediary' then (i.id=any(v_intermediary_ids) or exists (select 1 from public.partners scoped_partner where scoped_partner.id=any(v_partner_ids) and scoped_partner.partner_code=p.intermediary_code))
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      when v_actor_kind='employee' then
        p.rm_employee_id=any(v_employee_ids)
        or i.id=any(v_intermediary_ids)
        or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
      else false
    end
  )
  select jsonb_build_object(
    'total_policies',count(*),
    'in_force_policies',count(*) filter(
      where coalesce(start_date,current_date)<=current_date
        and (end_date is null or end_date>=current_date)
    ),
    'expiring_30_days',count(*) filter(where end_date between current_date and current_date+30),
    'expired_policies',count(*) filter(where end_date is not null and end_date<current_date),
    'upcoming_policies',count(*) filter(where start_date is not null and start_date>current_date),
    'total_premium',coalesce(sum(effective_premium),0),
    'motor_policies',count(*) filter(
      where lower(coalesce(policy_type,''))='motor'
        or lower(coalesce(business_line,''))='motor'
    )
  )
  into v_result
  from scoped_policies;

  return v_result;
end;
$function$
;
