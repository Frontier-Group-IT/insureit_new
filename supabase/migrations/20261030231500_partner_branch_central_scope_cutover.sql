-- Canonical Branch self-only checks in central in_scope RPCs.
-- Non-Branch function logic preserved from production as of 2026-10-30.
BEGIN;
CREATE OR REPLACE FUNCTION public.partner_app_claim_in_scope(p_claim_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_customer_id uuid;
begin
  -- Fail closed for all Branch sessions (active, inactive or ambiguous).
  IF EXISTS (SELECT 1 FROM public.portal_access_identities a WHERE a.profile_id=auth.uid() AND a.entity_type='branch')
     OR EXISTS (SELECT 1 FROM public.partner_branch_login_links b WHERE b.profile_id=auth.uid()) THEN
    RETURN EXISTS (SELECT 1 FROM public.partner_branch_authorized_claim_ids() scoped WHERE scoped.claim_id=p_claim_id);
  END IF;

  select c.customer_id
  into v_customer_id
  from public.claims c
  where c.id=p_claim_id;

  if not found then
    return false;
  end if;

  return public.partner_app_customer_in_scope(v_customer_id);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.partner_app_customer_in_scope(p_customer_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_lead_source_intermediary_id uuid;
begin
  -- Fail closed for all Branch sessions (active, inactive or ambiguous).
  IF EXISTS (SELECT 1 FROM public.portal_access_identities a WHERE a.profile_id=auth.uid() AND a.entity_type='branch')
     OR EXISTS (SELECT 1 FROM public.partner_branch_login_links b WHERE b.profile_id=auth.uid()) THEN
    RETURN EXISTS (SELECT 1 FROM public.partner_branch_authorized_customer_ids() scoped WHERE scoped.customer_id=p_customer_id);
  END IF;

  if p_customer_id is null then
    return false;
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    return false;
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  if v_scope_mode='none' then
    return false;
  end if;

  if v_actor_kind='employee' and v_scope_mode='organization' then
    return exists(select 1 from public.customers c where c.id=p_customer_id);
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select c.lead_source_intermediary_id
  into v_lead_source_intermediary_id
  from public.customers c
  where c.id=p_customer_id;

  return v_lead_source_intermediary_id is not null
    and v_lead_source_intermediary_id=any(v_intermediary_ids);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.partner_app_policy_in_scope(p_policy_id uuid)
 RETURNS boolean
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
  v_group_ids uuid[] := array[]::uuid[];
  v_policy public.policies%rowtype;
  v_intermediary_id uuid;
begin
  -- Fail closed for all Branch sessions (active, inactive or ambiguous).
  IF EXISTS (SELECT 1 FROM public.portal_access_identities a WHERE a.profile_id=auth.uid() AND a.entity_type='branch')
     OR EXISTS (SELECT 1 FROM public.partner_branch_login_links b WHERE b.profile_id=auth.uid()) THEN
    RETURN EXISTS (SELECT 1 FROM public.partner_branch_authorized_policy_ids() scoped WHERE scoped.policy_id=p_policy_id);
  END IF;

  if p_policy_id is null then
    return false;
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    return false;
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  if v_scope_mode='none' then
    return false;
  end if;

  select * into v_policy
  from public.policies
  where id=p_policy_id;

  if not found then
    return false;
  end if;

  if v_actor_kind='employee' and v_scope_mode='organization' then
    return true;
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  select i.id
  into v_intermediary_id
  from public.intermediaries i
  where i.intermediary_code=v_policy.intermediary_code
  limit 1;

  if v_actor_kind='intermediary' then
    return v_intermediary_id is not null
      and v_intermediary_id=any(v_intermediary_ids);
  end if;

  if v_actor_kind='employee' then
    return v_policy.rm_employee_id=any(v_employee_ids)
      or (v_intermediary_id is not null and v_intermediary_id=any(v_intermediary_ids))
      or (v_policy.intermediary_group_id is not null and v_policy.intermediary_group_id=any(v_group_ids));
  end if;

  return false;
end;
$function$
;
COMMIT;
