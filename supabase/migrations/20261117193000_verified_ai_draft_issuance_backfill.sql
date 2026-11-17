-- Fill ONLY an empty saved n8n Intake draft's issuance date after the
-- CURRENT document has completed 13 independent n8n checks. No customer,
-- policy, other draft field, or user-entered date is ever overwritten.
begin;

create or replace function public.fill_verified_ai_draft_issuance_date_v1(
  p_intake_id uuid,
  p_document_id uuid,
  p_fingerprint text,
  p_issuance_date date
)
returns boolean
language plpgsql security invoker set search_path=public,pg_catalog
as $$
declare v_intake_id uuid;
begin
  if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$'
     or p_issuance_date is null
     or p_issuance_date < date '2000-01-01'
     or p_issuance_date > current_date then return false; end if;
  update public.policy_intake_onboarding_drafts d
  set draft_payload=jsonb_set(d.draft_payload,'{issuanceDate}',
      to_jsonb(to_char(p_issuance_date,'YYYY-MM-DD')),true),
      revision=d.revision+1,updated_at=now()
  from public.policy_intake_requests i
  join public.policy_intake_documents doc on doc.intake_id=i.id
  join public.policy_intake_ai_processing_queue q on q.intake_id=i.id
  where d.intake_id=i.id and i.id=p_intake_id
    and i.status='in_review'
    and doc.id=p_document_id and doc.is_current=true
    and doc.storage_bucket=i.storage_bucket and doc.storage_path=i.storage_path
    and q.document_id=doc.id and q.state='verified'
    and q.extraction_fingerprint=p_fingerprint
    and q.checks_passed=13
    and q.field_keys @> array['policy_issuance_date']::text[]
    and coalesce(d.draft_payload->>'issuanceDate','')=''
    and coalesce(d.draft_payload->>'remarks','') like '%n8n validated ICICI 3005%'
  returning d.intake_id into v_intake_id;
  return v_intake_id is not null;
end;
$$;

revoke all on function public.fill_verified_ai_draft_issuance_date_v1(uuid,uuid,text,date)
  from public,anon,authenticated;
grant execute on function public.fill_verified_ai_draft_issuance_date_v1(uuid,uuid,text,date)
  to service_role;

commit;
