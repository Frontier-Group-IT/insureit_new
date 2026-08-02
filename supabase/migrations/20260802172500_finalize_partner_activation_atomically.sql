begin;

-- Finalize only the permanent parent Partner identity. Linked POSP/MISP account
-- creation remains a separate workflow and keeps its own normal/legacy ID rules.
create or replace function public.finalize_partner_activation_v2(
  p_application_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_data jsonb;
  v_raw_data jsonb;
  v_application_source text;
  v_profile_record_source text;
  v_workflow_stage text;
  v_profile_partner_id text;
  v_profile_partner_status text;
  v_application_partner_status text;
  v_account_context text;
  v_legacy_mode boolean;
  v_legacy_partner_id text;
  v_partner_id text;
  v_identity_source text;
  v_profile_updated uuid;
  v_application_updated uuid;
begin
  if p_application_id is null or p_actor_id is null then
    raise exception 'Partner activation request is incomplete';
  end if;

  select
    coalesce(a.draft_data, '{}'::jsonb),
    coalesce(p.raw_data, '{}'::jsonb),
    a.source,
    p.record_source,
    p.workflow_stage,
    nullif(upper(trim(p.partner_id)), ''),
    p.partner_status,
    a.partner_status
  into
    v_draft_data,
    v_raw_data,
    v_application_source,
    v_profile_record_source,
    v_workflow_stage,
    v_profile_partner_id,
    v_profile_partner_status,
    v_application_partner_status
  from public.intermediary_onboarding_applications a
  join public.posp_misp_onboarding_profiles p
    on p.application_id = a.id
  where a.id = p_application_id
  for update of a, p;

  if not found then
    raise exception 'Partner onboarding application was not found';
  end if;

  v_account_context := coalesce(
    nullif(v_draft_data->>'account_context', ''),
    nullif(v_raw_data->>'account_context', ''),
    'partner'
  );

  if v_account_context in ('posp', 'misp') then
    raise exception 'Only a parent Partner application can be activated by this operation';
  end if;

  v_legacy_mode :=
    v_draft_data->>'onboarding_mode' = 'legacy_existing_partner'
    or v_raw_data->>'onboarding_mode' = 'legacy_existing_partner'
    or v_draft_data->>'record_source' in ('legacy_manual', 'legacy_manual_pending_activation')
    or v_raw_data->>'record_source' in ('legacy_manual', 'legacy_manual_pending_activation')
    or v_application_source = 'legacy_manual'
    or v_profile_record_source in ('legacy_manual', 'legacy_manual_pending_activation');

  -- Safe retry: return the existing Partner identity only when every canonical
  -- record already agrees that the Partner is active.
  if v_profile_partner_status = 'active_partner'
     and v_application_partner_status = 'active_partner'
     and v_profile_partner_id is not null
     and v_profile_partner_id not like 'PENDING-%' then
    perform public.sync_partner_intermediary(p_application_id);

    if not exists (
      select 1
      from public.intermediaries i
      where i.application_id = p_application_id
        and i.intermediary_type = 'partner'
        and upper(trim(i.intermediary_code)) = v_profile_partner_id
    ) then
      raise exception 'Active Partner register state is inconsistent';
    end if;

    if not exists (
      select 1
      from public.intermediary_onboarding_applications a
      join public.posp_misp_onboarding_profiles pr on pr.application_id = a.id
      join public.partners p
        on p.id = coalesce(a.partner_record_id, pr.partner_record_id)
        or p.source_application_id = a.id
      where a.id = p_application_id
        and upper(trim(p.partner_code)) = v_profile_partner_id
    ) then
      raise exception 'Active canonical Partner state is inconsistent';
    end if;

    return jsonb_build_object(
      'partner_id', v_profile_partner_id,
      'identity_source', case when v_legacy_mode then 'legacy_manual' else 'generated' end,
      'already_active', true
    );
  end if;

  if v_workflow_stage <> 'iib_processing' then
    raise exception 'Partner activation is not available at the current workflow stage';
  end if;

  if v_legacy_mode then
    v_legacy_partner_id := nullif(upper(trim(coalesce(
      v_draft_data->>'legacy_partner_code',
      v_raw_data->>'legacy_partner_code',
      v_profile_partner_id
    ))), '');

    if v_legacy_partner_id is null or v_legacy_partner_id like 'PENDING-%' then
      raise exception 'The verified existing Partner ID is missing';
    end if;

    v_partner_id := public.issue_legacy_partner_identity(
      p_application_id,
      p_actor_id,
      v_legacy_partner_id
    );
    v_identity_source := 'legacy_manual';
  else
    v_partner_id := public.issue_partner_identity(p_application_id, p_actor_id);
    v_identity_source := 'generated';
  end if;

  v_partner_id := nullif(upper(trim(v_partner_id)), '');
  if v_partner_id is null or v_partner_id like 'PENDING-%' then
    raise exception 'A permanent Partner ID was not issued';
  end if;

  perform public.sync_partner_intermediary(p_application_id);

  update public.posp_misp_onboarding_profiles
     set workflow_stage = 'completed',
         partner_status = 'active_partner',
         final_account_type = 'partner',
         updated_by = p_actor_id,
         updated_at = now()
   where application_id = p_application_id
   returning id into v_profile_updated;

  if v_profile_updated is null then
    raise exception 'Partner onboarding profile could not be finalized';
  end if;

  update public.intermediary_onboarding_applications
     set final_type = 'partner',
         partner_status = 'active_partner',
         status = 'approved',
         registration_status = 'partner_active',
         reviewed_by = coalesce(reviewed_by, p_actor_id),
         reviewed_at = coalesce(reviewed_at, now()),
         completed_at = coalesce(completed_at, now()),
         updated_at = now()
   where id = p_application_id
   returning id into v_application_updated;

  if v_application_updated is null then
    raise exception 'Partner onboarding application could not be finalized';
  end if;

  if not exists (
    select 1
    from public.intermediaries i
    where i.application_id = p_application_id
      and i.intermediary_type = 'partner'
      and upper(trim(i.intermediary_code)) = v_partner_id
  ) then
    raise exception 'Partner register synchronization failed';
  end if;

  if not exists (
    select 1
    from public.intermediary_onboarding_applications a
    join public.posp_misp_onboarding_profiles pr on pr.application_id = a.id
    join public.partners p
      on p.id = coalesce(a.partner_record_id, pr.partner_record_id)
      or p.source_application_id = a.id
    where a.id = p_application_id
      and upper(trim(p.partner_code)) = v_partner_id
  ) then
    raise exception 'Canonical Partner record synchronization failed';
  end if;

  return jsonb_build_object(
    'partner_id', v_partner_id,
    'identity_source', v_identity_source,
    'already_active', false
  );
end;
$$;

revoke all on function public.finalize_partner_activation_v2(uuid, uuid) from public;
revoke all on function public.finalize_partner_activation_v2(uuid, uuid) from anon;
revoke all on function public.finalize_partner_activation_v2(uuid, uuid) from authenticated;
grant execute on function public.finalize_partner_activation_v2(uuid, uuid) to service_role;

commit;
