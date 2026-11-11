-- Partner Claim Tracker parity with Customer Portal external-claim financial data.
-- Apply only after reviewing the scoped RPC and successful Partner/Web CI.
-- Additive JSON response: existing claim, stages, journey and document data unchanged.
-- Financial milestones are limited to the already authorized claim, with ONLY
-- milestone name/status and one recorded amount. Internal claims return no financial milestones.
CREATE OR REPLACE FUNCTION public.partner_app_claim_detail(p_claim_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_result jsonb;
begin
  if not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim is not available in this Partner scope' using errcode='42501';
  end if;

  with base as (
    select cl.*,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      c.customer_code,v.vehicle_no,coalesce(p.policy_no,ep.policy_no) as policy_no,ic.name as insurer_name
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.policies p on p.id=cl.policy_id
    left join public.external_policies ep on ep.id=cl.external_policy_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    where cl.id=p_claim_id
  ),
  history as (
    select h.id,h.from_status::text as from_status,h.to_status::text as to_status,h.created_at
    from public.claim_status_history h where h.claim_id=p_claim_id order by h.created_at
  ),
  stages as (
    select s.id,s.stage::text as stage,s.details,s.created_at
    from public.claim_stage_details s where s.claim_id=p_claim_id order by s.created_at
  )
  select jsonb_build_object(
    'claim',jsonb_build_object(
      'id',b.id,'claim_no',b.claim_no,'insurer_claim_no',b.insurer_claim_no,'current_status',b.current_status::text,
      'claim_service_mode',b.claim_service_mode::text,'assistance_status',b.assistance_status::text,
      'external_policy_id',b.external_policy_id,
      'accident_at',b.accident_at,'spot_intimation_at',b.spot_intimation_at,'accident_location',b.accident_location,
      'accident_description',b.accident_description,'estimated_loss',b.estimated_loss,'approved_amount',b.approved_amount,
      'settlement_amount',b.settlement_amount,'created_at',b.created_at,'updated_at',b.updated_at
    ),
    'customer',jsonb_build_object('id',b.customer_id,'name',b.customer_name,'customer_code',b.customer_code),
    'vehicle',jsonb_build_object('id',b.vehicle_id,'vehicle_no',b.vehicle_no),
    'policy',jsonb_build_object('policy_no',b.policy_no),
    'insurer',jsonb_build_object('name',b.insurer_name),
    'status_history',coalesce((select jsonb_agg(jsonb_build_object('id',id,'from_status',from_status,'to_status',to_status,'created_at',created_at) order by created_at) from history),'[]'::jsonb),
    'documents',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.id,'name',d.file_name,'category',d.document_type,'mime_type',d.mime_type,
        'verification_status',d.verification_status::text,'created_at',d.created_at
      ) order by d.created_at,d.id)
      from public.claim_documents d where d.claim_id=p_claim_id
    ),'[]'::jsonb),
    'stages',coalesce((select jsonb_agg(jsonb_build_object('id',id,'stage',stage,'details',details,'created_at',created_at) order by created_at) from stages),'[]'::jsonb),
    -- Scoped external-claim financial milestones, matching Customer Portal source.
    -- Never expose unrelated customer-entered details or bypass partner_app_claim_in_scope.
    'financial_milestones',case when b.external_policy_id is not null then coalesce((
      select jsonb_agg(jsonb_build_object(
        'key',m.milestone_key::text,
        'status',m.milestone_status::text,
        'amount',case m.milestone_key::text
          when 'claim_intimation' then m.details->'estimate_amount'
          when 'billing' then m.details->'bill_amount'
          when 'delivery_order' then m.details->'do_amount'
          when 'payment_encashment' then m.details->'payment_received_amount'
          else null end
      ) order by m.updated_at,m.id)
      from public.claim_milestones m
      where m.claim_id=p_claim_id
        and m.milestone_key::text in ('work_approval','claim_intimation','billing','delivery_order','payment_encashment')
    ),'[]'::jsonb) else '[]'::jsonb end
  ) into v_result from base b;
  return v_result;
end;
$function$

