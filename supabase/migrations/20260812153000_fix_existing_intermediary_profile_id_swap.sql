begin;

create or replace function public.sync_existing_intermediary_migration(
  p_application_id uuid,
  p_actor_id uuid,
  p_migration jsonb,
  p_registration_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.intermediary_onboarding_applications%rowtype;
  v_partner_record_id uuid;
  v_partner_application_id uuid;
  v_partner_code text := nullif(upper(btrim(p_migration ->> 'legacy_partner_code')), '');
  v_registration_code text := nullif(upper(btrim(p_migration ->> 'legacy_registration_code')), '');
  v_original_onboarding_date date := nullif(p_migration ->> 'legacy_original_onboarding_date', '')::date;
  v_original_activation_date date := nullif(p_migration ->> 'legacy_original_activation_date', '')::date;
  v_activation_at timestamptz := case
    when nullif(p_migration ->> 'legacy_original_activation_date', '') is null then null
    else (p_migration ->> 'legacy_original_activation_date')::date::timestamptz
  end;
  v_now timestamptz := now();
  v_tmp text := 'SYNC-' || replace(gen_random_uuid()::text, '-', '');
  v_has_linked_account boolean := false;
  v_application_ids uuid[];
begin
  if p_application_id is null then
    raise exception 'Application reference is missing.';
  end if;
  if v_partner_code is null then
    raise exception 'Existing Partner ID is required.';
  end if;
  if v_registration_code is null then
    raise exception 'Existing POSP/MISP ID is required.';
  end if;
  if v_partner_code = v_registration_code then
    raise exception 'Partner ID and POSP/MISP ID must be different.';
  end if;
  if v_partner_code like 'PENDING-%' or v_registration_code like 'PENDING-%' then
    raise exception 'Temporary PENDING identifiers cannot be used.';
  end if;
  if v_original_onboarding_date is not null
     and v_original_activation_date is not null
     and v_original_activation_date < v_original_onboarding_date then
    raise exception 'Activation date cannot be earlier than onboarding date.';
  end if;

  select *
    into v_current
  from public.intermediary_onboarding_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception 'The migration record could not be found.';
  end if;

  v_partner_record_id := v_current.partner_record_id;
  if v_partner_record_id is null then
    raise exception 'This legacy account is not linked to a Partner record.';
  end if;

  select array_agg(locked.id order by locked.created_at)
    into v_application_ids
  from (
    select a.id, a.created_at
    from public.intermediary_onboarding_applications a
    where a.partner_record_id = v_partner_record_id
    for update
  ) locked;

  if v_application_ids is null or array_length(v_application_ids, 1) is null then
    v_application_ids := array[p_application_id];
  end if;

  select a.id
    into v_partner_application_id
  from public.intermediary_onboarding_applications a
  where a.id = any(v_application_ids)
    and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') not in ('posp', 'misp')
  order by a.created_at
  limit 1;

  if v_partner_application_id is null then
    raise exception 'The linked Partner application could not be found.';
  end if;

  select exists (
    select 1
    from public.intermediary_onboarding_applications a
    where a.id = any(v_application_ids)
      and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp')
  ) into v_has_linked_account;

  if exists (
    select 1
    from public.partners p
    where upper(p.partner_code) = v_partner_code
      and p.id <> v_partner_record_id
  ) then
    raise exception 'The entered Partner ID is already used by another Partner.';
  end if;

  if exists (
    select 1
    from public.posp_misp_onboarding_profiles p
    where upper(p.external_onboarding_id) in (v_partner_code, v_registration_code)
      and p.application_id <> all(v_application_ids)
  ) then
    raise exception 'The entered Partner or POSP/MISP ID is already used by another profile.';
  end if;

  if exists (
    select 1
    from public.intermediaries i
    where upper(i.intermediary_code) in (v_partner_code, v_registration_code)
      and (i.application_id is null or i.application_id <> all(v_application_ids))
  ) then
    raise exception 'The entered Partner or POSP/MISP ID is already used in the intermediary register.';
  end if;

  if exists (
    select 1
    from public.intermediary_registrations r
    where upper(r.registration_code) = v_registration_code
      and r.application_id <> all(v_application_ids)
  ) then
    raise exception 'The entered POSP/MISP ID is already used by another registration.';
  end if;

  -- Temporarily free unique/trigger-validated codes so ID swaps are deterministic.
  update public.intermediaries i
     set intermediary_code = v_tmp || '-' || left(i.id::text, 8),
         onboarding_id = v_tmp || '-' || left(i.id::text, 8),
         updated_at = v_now
   where i.application_id = any(v_application_ids);

  update public.intermediary_registrations r
     set registration_code = v_tmp || '-' || left(r.id::text, 8),
         updated_at = v_now
   where r.application_id = any(v_application_ids);

  update public.posp_misp_onboarding_profiles p
     set external_onboarding_id = v_tmp || '-' || left(p.id::text, 8),
         updated_by = p_actor_id,
         updated_at = v_now
   where p.application_id = any(v_application_ids);

  update public.partners
     set partner_code = v_partner_code,
         updated_at = v_now
   where id = v_partner_record_id;

  update public.intermediary_onboarding_applications a
     set draft_data = coalesce(a.draft_data, '{}'::jsonb) || p_migration,
         registration_status = case
           when coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp')
             then p_registration_status
           else a.registration_status
         end,
         updated_at = v_now
   where a.id = any(v_application_ids);

  update public.posp_misp_onboarding_profiles p
     set partner_id = v_partner_code,
         partner_record_id = v_partner_record_id,
         raw_data = coalesce(p.raw_data, '{}'::jsonb) || p_migration,
         onboarding_date = v_original_onboarding_date,
         external_onboarding_id = case
           when coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp') then v_registration_code
           when v_has_linked_account then v_partner_code
           else v_registration_code
         end,
         existing_registration_confirmed = case
           when coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp') then true
           when v_has_linked_account then false
           else true
         end,
         existing_registration_code = case
           when coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp') then v_registration_code
           when v_has_linked_account then null
           else v_registration_code
         end,
         existing_registration_confirmed_at = case
           when coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp') or not v_has_linked_account
             then v_now
           else null
         end,
         updated_by = p_actor_id,
         updated_at = v_now
    from public.intermediary_onboarding_applications a
   where a.id = p.application_id
     and a.id = any(v_application_ids);

  update public.intermediaries i
     set intermediary_code = case
           when coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp') then v_registration_code
           else v_partner_code
         end,
         onboarding_id = case
           when coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp') then v_registration_code
           else v_partner_code
         end,
         activated_at = coalesce(v_activation_at, i.activated_at),
         updated_at = v_now
    from public.intermediary_onboarding_applications a
   where a.id = i.application_id
     and a.id = any(v_application_ids);

  update public.intermediary_registrations r
     set registration_code = v_registration_code,
         registration_status = p_registration_status,
         training_status = p_migration ->> 'legacy_training_status',
         exam_status = p_migration ->> 'legacy_exam_status',
         agreement_status = p_migration ->> 'legacy_agreement_status',
         iib_status = p_migration ->> 'legacy_iib_registration_status',
         activated_at = coalesce(v_activation_at, r.activated_at),
         updated_at = v_now
    from public.intermediary_onboarding_applications a
   where a.id = r.application_id
     and a.id = any(v_application_ids)
     and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp');

  update public.intermediary_training_exam_assignments t
     set training_status = p_migration ->> 'legacy_training_status',
         training_completed_at = case when p_migration ->> 'legacy_training_status' = 'completed' then coalesce(v_activation_at, v_now) else null end,
         exam_status = p_migration ->> 'legacy_exam_status',
         exam_completed_at = case when p_migration ->> 'legacy_exam_status' in ('passed', 'failed', 'attempts_exhausted') then coalesce(v_activation_at, v_now) else null end,
         exam_passed_at = case when p_migration ->> 'legacy_exam_status' = 'passed' then coalesce(v_activation_at, v_now) else null end,
         agreement_status = p_migration ->> 'legacy_agreement_status',
         agreement_signed_at = case when p_migration ->> 'legacy_agreement_status' = 'signed' then coalesce(v_activation_at, v_now) else null end,
         updated_by = p_actor_id,
         updated_at = v_now
    from public.intermediary_onboarding_applications a
   where a.id = t.application_id
     and a.id = any(v_application_ids)
     and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp');

  return jsonb_build_object(
    'application_ids', to_jsonb(v_application_ids),
    'partner_application_id', v_partner_application_id,
    'partner_code', v_partner_code,
    'registration_code', v_registration_code
  );
end;
$$;

revoke all on function public.sync_existing_intermediary_migration(uuid, uuid, jsonb, text) from public;
grant execute on function public.sync_existing_intermediary_migration(uuid, uuid, jsonb, text) to service_role;

commit;
