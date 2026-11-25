-- A single database transaction serializes reviewer status, assignment, and
-- draft revision. Only the authenticated Supabase Edge service-role client may
-- invoke this function after verifying the user's live identity/permissions.
-- No write privileges are granted to mobile callers.
create or replace function public.partner_app_save_intake_draft_atomic(
  p_intake_id uuid,
  p_reviewer_id uuid,
  p_expected_revision integer,
  p_draft jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $fn$
declare
  v_intake public.policy_intake_requests%rowtype;
  v_revision integer;
begin
  if p_intake_id is null or p_reviewer_id is null
     or p_expected_revision is null or p_expected_revision < 1
     or jsonb_typeof(p_draft) is distinct from 'object' then
    return jsonb_build_object('ok',false,'error','Invalid draft revision or values.','status',400);
  end if;

  -- FOR UPDATE blocks reassignment or booking status transition during this save.
  select * into v_intake from public.policy_intake_requests
    where id = p_intake_id for update;
  if not found or v_intake.status is distinct from 'in_review'
     or v_intake.assigned_to_profile_id is distinct from p_reviewer_id then
    return jsonb_build_object('ok',false,'error','You are no longer the assigned reviewer.','status',409);
  end if;

  update public.policy_intake_onboarding_drafts
    set draft_payload=p_draft,
        revision=p_expected_revision+1,
        updated_by_profile_id=p_reviewer_id,
        updated_at=now()
    where intake_id=p_intake_id and revision=p_expected_revision
    returning revision into v_revision;
  if not found then
    return jsonb_build_object('ok',false,'error','The draft was edited elsewhere. Reload before saving.','status',409);
  end if;
  return jsonb_build_object('ok',true,'revision',v_revision);
end
$fn$;

revoke all on function public.partner_app_save_intake_draft_atomic(uuid,uuid,integer,jsonb) from PUBLIC, anon, authenticated;
grant execute on function public.partner_app_save_intake_draft_atomic(uuid,uuid,integer,jsonb) to service_role;
