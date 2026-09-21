begin;

create or replace function public.partner_app_policy_detail(p_policy_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.partner_app_policy_in_scope(p_policy_id) then
    raise exception 'Policy is not available in this Partner scope' using errcode='42501';
  end if;

  with base as (
    select
      p.*,
      c.id as customer_row_id,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      c.customer_code,
      v.id as vehicle_row_id,
      v.vehicle_no,
      v.vehicle_type,
      v.make,
      v.model,
      v.year,
      v.vehicle_category,
      v.is_commercial,
      ic.id as insurer_id,
      ic.name as insurer_name,
      ppd.gross_premium,
      ppd.net_premium,
      ppd.od_premium,
      ppd.tp_premium,
      ppd.cpa_opted,
      ppd.cpa_amount,
      ppd.gst_amount
    from public.policies p
    left join public.customers c on c.id=p.customer_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    left join lateral (
      select x.*
      from public.policy_premium_details x
      where x.policy_id=p.id
      order by x.updated_at desc,x.created_at desc
      limit 1
    ) ppd on true
    where p.id=p_policy_id
  ),
  audit_rows as (
    select
      'audit:' || a.id::text as id,
      a.action,
      a.actor_id::text as actor_id,
      a.created_at as at
    from public.audit_logs a
    where a.table_name='policies'
      and a.record_id=p_policy_id
      and a.action in (
        'policy_created',
        'policy_edited',
        'policy_doc_uploaded',
        'policy_doc_replaced',
        'policy_doc_removed',
        'payin_billing_added',
        'payin_billing_updated',
        'policy_superseded',
        'policy_replacement_created',
        'policy_data_corrected',
        'vehicle_data_corrected'
      )
  ),
  audit_flags as (
    select
      coalesce(bool_or(action='policy_created'),false) as has_created,
      coalesce(bool_or(action='policy_edited'),false) as has_edited,
      coalesce(bool_or(action in ('policy_doc_uploaded','policy_doc_replaced','policy_doc_removed')),false) as has_document
    from audit_rows
  ),
  latest_document as (
    select
      d.uploaded_by::text as actor_id,
      d.created_at,
      d.updated_at
    from public.policy_documents d
    where d.policy_id=p_policy_id
      and d.document_type='policy_copy'
    order by d.updated_at desc
    limit 1
  ),
  derived_rows as (
    select
      'derived:policy-created'::text as id,
      'policy_created'::text as action,
      b.created_by::text as actor_id,
      b.created_at as at
    from base b
    cross join audit_flags f
    where b.created_at is not null and not f.has_created

    union all

    select
      'derived:legacy-policy-edited',
      'policy_edited',
      null::text,
      b.updated_at
    from base b
    cross join audit_flags f
    where b.updated_at is not null
      and b.created_at is not null
      and extract(epoch from (b.updated_at-b.created_at)) > 1
      and not f.has_edited

    union all

    select
      'derived:legacy-policy-document',
      case
        when d.updated_at is not null
          and d.created_at is not null
          and extract(epoch from (d.updated_at-d.created_at)) > 1
        then 'policy_doc_replaced'
        else 'policy_doc_uploaded'
      end,
      d.actor_id,
      coalesce(
        case
          when d.updated_at is not null
            and d.created_at is not null
            and extract(epoch from (d.updated_at-d.created_at)) > 1
          then d.updated_at
          else d.created_at
        end,
        d.updated_at,
        d.created_at
      )
    from latest_document d
    cross join audit_flags f
    where not f.has_document
      and (d.updated_at is not null or d.created_at is not null)
  ),
  activity_candidates as (
    select * from audit_rows
    union all
    select * from derived_rows
  ),
  activity_with_actor as (
    select
      a.id,
      case a.action
        when 'policy_created' then 'Policy Created'
        when 'policy_edited' then 'Policy Edited'
        when 'policy_doc_uploaded' then 'Policy Doc. Uploaded'
        when 'policy_doc_replaced' then 'Policy Doc. Replaced'
        when 'policy_doc_removed' then 'Policy Doc. Removed'
        when 'payin_billing_added' then 'Pay-in Billing Added'
        when 'payin_billing_updated' then 'Pay-in Billing Updated'
        when 'policy_superseded' then 'Policy Superseded'
        when 'policy_replacement_created' then 'Replacement Policy Created'
        when 'policy_data_corrected' then 'Policy Data Corrected'
        when 'vehicle_data_corrected' then 'Vehicle Data Corrected'
        else initcap(replace(a.action,'_',' '))
      end as action,
      case
        when a.actor_id is null and a.action in ('policy_data_corrected','vehicle_data_corrected') then 'System Reconciliation'
        else coalesce(nullif(btrim(pr.full_name),''),'Not recorded')
      end as actor_name,
      a.at
    from activity_candidates a
    left join public.profiles pr on pr.id::text=a.actor_id
    where a.at is not null
  )
  select jsonb_build_object(
    'policy',jsonb_build_object(
      'id',b.id,
      'policy_code',b.policy_code,
      'policy_no',b.policy_no,
      'policy_type',b.policy_type,
      'policy_product',b.policy_product,
      'business_line',b.business_line,
      'business_type',b.business_type,
      'start_date',b.start_date,
      'end_date',b.end_date,
      'issuance_date',b.issuance_date,
      'status',b.status,
      'insured_declared_value',b.insured_declared_value,
      'lifecycle_status',case
        when b.end_date is not null and b.end_date<current_date then 'expired'
        when b.start_date is not null and b.start_date>current_date then 'upcoming'
        when b.end_date between current_date and current_date+30 then 'expiring'
        else 'in_force'
      end
    ),
    'premium',jsonb_build_object(
      'gross_premium',coalesce(b.gross_premium,b.premium_amount,0),
      'net_premium',b.net_premium,
      'od_premium',b.od_premium,
      'tp_premium',b.tp_premium,
      'cpa_opted',b.cpa_opted,
      'cpa_amount',b.cpa_amount,
      'gst_amount',b.gst_amount
    ),
    'customer',jsonb_build_object(
      'id',b.customer_row_id,
      'name',b.customer_name,
      'customer_code',b.customer_code
    ),
    'vehicle',case
      when b.vehicle_row_id is null then null
      else jsonb_build_object(
        'id',b.vehicle_row_id,
        'vehicle_no',b.vehicle_no,
        'vehicle_type',b.vehicle_type,
        'make',b.make,
        'model',b.model,
        'year',b.year,
        'vehicle_category',b.vehicle_category,
        'is_commercial',b.is_commercial
      )
    end,
    'insurer',jsonb_build_object(
      'id',b.insurer_id,
      'name',b.insurer_name
    ),
    'commercial',jsonb_build_object(
      'intermediary_type',b.intermediary_type,
      'intermediary_code',b.intermediary_code,
      'rm_name',b.rm_name,
      'group_code',b.intermediary_group_code,
      'group_name',b.intermediary_group_name
    ),
    'activity_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,
        'action',a.action,
        'actor_name',a.actor_name,
        'at',a.at
      ) order by a.at desc)
      from activity_with_actor a
    ),'[]'::jsonb)
  )
  into v_result
  from base b;

  return v_result;
end;
$$;

revoke all on function public.partner_app_policy_detail(uuid) from public, anon;
grant execute on function public.partner_app_policy_detail(uuid) to authenticated, service_role;

create or replace function public.partner_app_vehicle_detail(p_vehicle_id uuid)
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
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  with scoped_policies as (
    select p.id, p.vehicle_id
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where p.vehicle_id=p_vehicle_id
      and case
        when v_scope_mode='none' then false
        when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        when v_actor_kind='employee' then
          p.rm_employee_id=any(v_employee_ids)
          or i.id=any(v_intermediary_ids)
          or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
        else false
      end
  ),
  vehicle_row as (
    select
      v.id,
      v.customer_id,
      v.vehicle_no,
      v.vehicle_type,
      v.make,
      v.model,
      v.year,
      v.registration_status,
      v.registration_date,
      v.chassis_no,
      v.engine_no,
      v.fuel_type,
      v.gvw_kg,
      v.fitness_expiry_date,
      v.puc_expiry_date,
      v.road_tax_expiry_date,
      v.national_permit_expiry_date,
      v.local_permit_expiry_date,
      v.created_at,
      v.updated_at,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name
    from public.vehicles v
    left join public.customers c on c.id=v.customer_id
    where v.id=p_vehicle_id
      and exists (select 1 from scoped_policies sp where sp.vehicle_id=v.id)
  ),
  activity as (
    select
      (select count(distinct sp.id)::int from scoped_policies sp) as policies,
      (
        select count(*)::int
        from public.claims cl
        where cl.vehicle_id=p_vehicle_id
          and public.partner_app_claim_in_scope(cl.id)
      ) as claims
  ),
  audit_rows as (
    select
      'audit:' || a.id::text as id,
      a.action,
      a.actor_id::text as actor_id,
      a.created_at as at
    from public.audit_logs a
    where a.table_name='vehicles'
      and a.record_id=p_vehicle_id
      and a.action in (
        'vehicle_created',
        'vehicle_edited',
        'vehicle_linked_to_policy',
        'vehicle_registration_updated'
      )
  ),
  audit_flags as (
    select
      coalesce(bool_or(action='vehicle_created'),false) as has_created,
      coalesce(bool_or(action='vehicle_edited'),false) as has_edited
    from audit_rows
  ),
  derived_rows as (
    select
      'derived:vehicle-created'::text as id,
      'vehicle_created'::text as action,
      null::text as actor_id,
      vr.created_at as at
    from vehicle_row vr
    cross join audit_flags f
    where vr.created_at is not null and not f.has_created

    union all

    select
      'derived:legacy-vehicle-edited',
      'vehicle_edited',
      null::text,
      vr.updated_at
    from vehicle_row vr
    cross join audit_flags f
    where vr.updated_at is not null
      and vr.created_at is not null
      and extract(epoch from (vr.updated_at-vr.created_at)) > 1
      and not f.has_edited
  ),
  activity_candidates as (
    select * from audit_rows
    union all
    select * from derived_rows
  ),
  activity_with_actor as (
    select
      a.id,
      case a.action
        when 'vehicle_created' then 'Vehicle Created'
        when 'vehicle_edited' then 'Vehicle Edited'
        when 'vehicle_linked_to_policy' then 'Vehicle Linked to Policy'
        when 'vehicle_registration_updated' then 'Vehicle Registration Updated'
        else initcap(replace(a.action,'_',' '))
      end as action,
      coalesce(nullif(btrim(pr.full_name),''),'Not recorded') as actor_name,
      a.at
    from activity_candidates a
    left join public.profiles pr on pr.id::text=a.actor_id
    where a.at is not null
  )
  select jsonb_build_object(
    'vehicle', jsonb_build_object(
      'vehicle_id', vr.id,
      'customer_id', vr.customer_id,
      'vehicle_no', vr.vehicle_no,
      'vehicle_type', vr.vehicle_type,
      'make', vr.make,
      'model', vr.model,
      'year', vr.year,
      'registration_status', vr.registration_status,
      'registration_date', vr.registration_date,
      'chassis_no', vr.chassis_no,
      'engine_no', vr.engine_no,
      'fuel_type', vr.fuel_type,
      'gvw_kg', vr.gvw_kg,
      'fitness_expiry_date', vr.fitness_expiry_date,
      'puc_expiry_date', vr.puc_expiry_date,
      'road_tax_expiry_date', vr.road_tax_expiry_date,
      'national_permit_expiry_date', vr.national_permit_expiry_date,
      'local_permit_expiry_date', vr.local_permit_expiry_date
    ),
    'customer', jsonb_build_object(
      'customer_id', vr.customer_id,
      'customer_name', vr.customer_name
    ),
    'activity', jsonb_build_object(
      'policies', a.policies,
      'claims', a.claims
    ),
    'activity_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id,
        'action', h.action,
        'actor_name', h.actor_name,
        'at', h.at
      ) order by h.at desc)
      from activity_with_actor h
    ), '[]'::jsonb)
  )
  into v_result
  from vehicle_row vr
  cross join activity a;

  if v_result is null then
    raise exception 'Vehicle is not available in this Partner scope' using errcode='42501';
  end if;

  return v_result;
end;
$$;

revoke all on function public.partner_app_vehicle_detail(uuid) from public, anon;
grant execute on function public.partner_app_vehicle_detail(uuid) to authenticated, service_role;


commit;
