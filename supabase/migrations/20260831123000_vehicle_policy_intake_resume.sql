-- Deployment retrigger: dedicated GitHub Actions schema workflow
begin;

create table if not exists public.policy_intake_onboarding_drafts (
  intake_id uuid primary key references public.policy_intake_requests(id) on delete cascade,
  draft_payload jsonb not null default '{}'::jsonb,
  revision integer not null default 1 check (revision > 0),
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_policy_intake_drafts_updated on public.policy_intake_onboarding_drafts(updated_at desc);
alter table public.policy_intake_onboarding_drafts enable row level security;
revoke all on public.policy_intake_onboarding_drafts from anon, authenticated;
grant all on public.policy_intake_onboarding_drafts to service_role;

create or replace function public.finalize_policy_intake_motor_v1(p_intake_id uuid,p_payload jsonb,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_actor uuid; v_intake public.policy_intake_requests%rowtype; v_draft public.policy_intake_onboarding_drafts%rowtype;
  v_policy_result jsonb; v_policy_id uuid; v_document public.policy_intake_documents%rowtype;
begin
  v_actor:=nullif(p_payload #>> '{meta,requestedBy}','')::uuid;
  if v_actor is null then raise exception 'Policy Intake finalization requires an authenticated actor.'; end if;
  select * into v_intake from public.policy_intake_requests where id=p_intake_id for update;
  if v_intake.id is null then raise exception 'Policy Intake not found.'; end if;
  if v_intake.status<>'in_review' then raise exception 'Policy Intake is not in review.'; end if;
  if v_intake.assigned_to_profile_id is distinct from v_actor then raise exception 'Policy Intake is assigned to another reviewer.'; end if;
  if v_intake.final_policy_id is not null then raise exception 'Policy Intake is already finalized.'; end if;
  select * into v_draft from public.policy_intake_onboarding_drafts where intake_id=p_intake_id for update;
  if v_draft.intake_id is null then raise exception 'Policy Intake draft is missing.'; end if;
  if v_draft.revision<>p_expected_revision then raise exception 'Policy Intake draft changed. Reload before finalizing.'; end if;

  v_policy_result:=public.onboard_motor_policy_commercial_status_v2(p_payload);
  v_policy_id:=nullif(v_policy_result->>'policyId','')::uuid;
  if coalesce((v_policy_result->>'ok')::boolean,false) is not true or v_policy_id is null then raise exception 'Policy booking did not return a valid policy.'; end if;

  select * into v_document from public.policy_intake_documents where intake_id=p_intake_id and is_current order by created_at desc limit 1;
  if v_document.id is null then raise exception 'Current Policy Intake document is missing.'; end if;

  insert into public.policy_documents(policy_id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,uploaded_by,source_intake_id,source_intake_document_id)
  values(v_policy_id,'policy_copy',v_document.file_name,v_document.storage_bucket,v_document.storage_path,v_document.mime_type,v_document.file_size,v_actor,p_intake_id,v_document.id)
  on conflict(storage_bucket,storage_path) do update set policy_id=excluded.policy_id,document_type=excluded.document_type,source_intake_id=excluded.source_intake_id,source_intake_document_id=excluded.source_intake_document_id,uploaded_by=excluded.uploaded_by,updated_at=now();

  update public.policy_intake_requests set status='completed',final_policy_id=v_policy_id,finalized_by_profile_id=v_actor,finalized_at=now(),attention_reason=null where id=p_intake_id;
  delete from public.policy_intake_onboarding_drafts where intake_id=p_intake_id;
  return v_policy_result;
end; $$;
revoke all on function public.finalize_policy_intake_motor_v1(uuid,jsonb,integer) from public;
grant execute on function public.finalize_policy_intake_motor_v1(uuid,jsonb,integer) to service_role;
commit;
