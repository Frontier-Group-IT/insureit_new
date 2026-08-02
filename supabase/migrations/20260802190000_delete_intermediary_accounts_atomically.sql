begin;

create table if not exists public.intermediary_account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  requested_application_id uuid not null,
  deletion_mode text not null check (deletion_mode in ('child', 'partner')),
  partner_record_id uuid,
  partner_code text,
  deleted_application_ids uuid[] not null default '{}'::uuid[],
  deleted_registration_codes text[] not null default '{}'::text[],
  deleted_auth_user_ids uuid[] not null default '{}'::uuid[],
  actor_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  deleted_at timestamptz not null default now()
);

create index if not exists intermediary_account_deletion_audit_deleted_at_idx
  on public.intermediary_account_deletion_audit (deleted_at desc);

alter table public.intermediary_account_deletion_audit enable row level security;

create or replace function public.delete_intermediary_account_v1(
  p_application_id uuid,
  p_deletion_mode text,
  p_actor_id uuid,
  p_auth_user_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.intermediary_onboarding_applications%rowtype;
  v_profile public.posp_misp_onboarding_profiles%rowtype;
  v_account_context text;
  v_partner_record_id uuid;
  v_partner_code text;
  v_parent_application_id uuid;
  v_target_application_ids uuid[] := '{}'::uuid[];
  v_registration_ids uuid[] := '{}'::uuid[];
  v_registration_codes text[] := '{}'::text[];
  v_legacy_registration_code text;
  v_deleted_applications integer := 0;
  v_deleted_registrations integer := 0;
  v_deleted_intermediaries integer := 0;
begin
  if p_application_id is null or p_actor_id is null then
    raise exception using errcode = '22023', message = 'A valid application and actor are required.';
  end if;

  if p_deletion_mode not in ('child', 'partner') then
    raise exception using errcode = '22023', message = 'Unsupported intermediary deletion mode.';
  end if;

  select * into v_application
  from public.intermediary_onboarding_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Intermediary application not found.';
  end if;

  select * into v_profile
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Intermediary onboarding profile not found.';
  end if;

  v_account_context := case
    when coalesce(v_application.draft_data ->> 'account_context', '') in ('posp', 'misp')
      then v_application.draft_data ->> 'account_context'
    else 'partner'
  end;

  v_partner_record_id := coalesce(v_application.partner_record_id, v_profile.partner_record_id);
  v_partner_code := nullif(btrim(v_profile.partner_id), '');

  if p_deletion_mode = 'child' then
    if v_account_context not in ('posp', 'misp') then
      raise exception using errcode = '22023', message = 'Only a linked POSP or MISP account can be deleted in child mode.';
    end if;

    v_target_application_ids := array[p_application_id];

    select parent.id into v_parent_application_id
    from public.intermediary_onboarding_applications parent
    where parent.id <> p_application_id
      and (
        (v_partner_record_id is not null and parent.partner_record_id = v_partner_record_id)
        or parent.id::text = v_application.draft_data ->> 'parent_partner_application_id'
      )
      and coalesce(parent.draft_data ->> 'account_context', 'partner') = 'partner'
    order by parent.created_at asc
    limit 1
    for update;

    if v_parent_application_id is null then
      raise exception using errcode = '23514', message = 'The linked Partner record could not be resolved.';
    end if;

    if v_profile.record_source = 'legacy_manual' then
      select coalesce(
        nullif(btrim(v_profile.existing_registration_code), ''),
        nullif(btrim(v_profile.external_onboarding_id), ''),
        (
          select nullif(btrim(r.registration_code), '')
          from public.intermediary_registrations r
          where r.application_id = p_application_id
          limit 1
        ),
        (
          select nullif(btrim(i.intermediary_code), '')
          from public.intermediaries i
          where i.application_id = p_application_id
          limit 1
        )
      ) into v_legacy_registration_code;
    end if;
  else
    if v_account_context <> 'partner' then
      raise exception using errcode = '22023', message = 'Only a Partner account can be deleted in partner mode.';
    end if;

    select coalesce(array_agg(a.id order by case when a.id = p_application_id then 0 else 1 end, a.created_at), array[p_application_id])
      into v_target_application_ids
    from public.intermediary_onboarding_applications a
    where a.id = p_application_id
       or (v_partner_record_id is not null and a.partner_record_id = v_partner_record_id)
       or a.draft_data ->> 'parent_partner_application_id' = p_application_id::text;

    perform 1
    from public.intermediary_onboarding_applications a
    where a.id = any(v_target_application_ids)
    for update;
  end if;

  select coalesce(array_agg(distinct x.id), '{}'::uuid[])
    into v_registration_ids
  from (
    select r.id
    from public.intermediary_registrations r
    where r.application_id = any(v_target_application_ids)
    union
    select a.registration_record_id
    from public.intermediary_onboarding_applications a
    where a.id = any(v_target_application_ids)
      and a.registration_record_id is not null
    union
    select p.registration_record_id
    from public.posp_misp_onboarding_profiles p
    where p.application_id = any(v_target_application_ids)
      and p.registration_record_id is not null
  ) x;

  select coalesce(array_agg(distinct code), '{}'::text[])
    into v_registration_codes
  from (
    select nullif(btrim(r.registration_code), '') as code
    from public.intermediary_registrations r
    where r.id = any(v_registration_ids)
    union
    select nullif(btrim(i.intermediary_code), '')
    from public.intermediaries i
    where i.application_id = any(v_target_application_ids)
    union
    select nullif(btrim(p.external_onboarding_id), '')
    from public.posp_misp_onboarding_profiles p
    where p.application_id = any(v_target_application_ids)
  ) codes
  where code is not null;

  if to_regclass('public.intermediary_portal_accounts') is not null then
    execute 'delete from public.intermediary_portal_accounts where application_id = any($1)'
      using v_target_application_ids;
  end if;

  if to_regclass('public.intermediary_iib_submission_packets') is not null then
    execute 'delete from public.intermediary_iib_submission_packets where application_id = any($1)'
      using v_target_application_ids;
  end if;

  if to_regclass('public.intermediary_training_exam_assignments') is not null then
    execute 'delete from public.intermediary_training_exam_assignments where application_id = any($1)'
      using v_target_application_ids;
  end if;

  if to_regclass('public.intermediary_onboarding_contacts') is not null then
    execute 'delete from public.intermediary_onboarding_contacts where application_id = any($1)'
      using v_target_application_ids;
  end if;

  if to_regclass('public.intermediary_onboarding_documents') is not null then
    execute 'delete from public.intermediary_onboarding_documents where application_id = any($1)'
      using v_target_application_ids;
  end if;

  delete from public.intermediaries
  where application_id = any(v_target_application_ids);
  get diagnostics v_deleted_intermediaries = row_count;

  update public.intermediary_onboarding_applications
  set registration_record_id = null,
      updated_at = now()
  where id = any(v_target_application_ids)
    and registration_record_id is not null;

  update public.posp_misp_onboarding_profiles
  set registration_record_id = null,
      updated_at = now()
  where application_id = any(v_target_application_ids)
    and registration_record_id is not null;

  if cardinality(v_registration_ids) > 0 then
    delete from public.intermediary_registrations
    where id = any(v_registration_ids);
    get diagnostics v_deleted_registrations = row_count;
  end if;

  if p_deletion_mode = 'child'
     and v_legacy_registration_code is not null
     and v_parent_application_id is not null then
    update public.posp_misp_onboarding_profiles
    set existing_registration_code = v_legacy_registration_code,
        existing_registration_confirmed = true,
        existing_registration_confirmed_at = coalesce(existing_registration_confirmed_at, now()),
        updated_by = p_actor_id,
        updated_at = now()
    where application_id = v_parent_application_id;
  end if;

  delete from public.posp_misp_onboarding_profiles
  where application_id = any(v_target_application_ids);

  if p_deletion_mode = 'partner' then
    update public.intermediary_onboarding_applications
    set partner_record_id = null,
        updated_at = now()
    where id = any(v_target_application_ids)
      and partner_record_id is not null;

    if v_partner_record_id is not null then
      delete from public.partners
      where id = v_partner_record_id;
    else
      delete from public.partners
      where source_application_id = p_application_id;
    end if;
  end if;

  delete from public.intermediary_onboarding_applications
  where id = any(v_target_application_ids);
  get diagnostics v_deleted_applications = row_count;

  if v_deleted_applications <> cardinality(v_target_application_ids) then
    raise exception using errcode = 'P0001', message = 'Not every selected intermediary application was deleted.';
  end if;

  insert into public.intermediary_account_deletion_audit (
    requested_application_id,
    deletion_mode,
    partner_record_id,
    partner_code,
    deleted_application_ids,
    deleted_registration_codes,
    deleted_auth_user_ids,
    actor_id,
    details
  ) values (
    p_application_id,
    p_deletion_mode,
    v_partner_record_id,
    v_partner_code,
    v_target_application_ids,
    v_registration_codes,
    coalesce(p_auth_user_ids, '{}'::uuid[]),
    p_actor_id,
    jsonb_build_object(
      'account_context', v_account_context,
      'deleted_applications', v_deleted_applications,
      'deleted_registrations', v_deleted_registrations,
      'deleted_intermediaries', v_deleted_intermediaries,
      'legacy_registration_restored_to_parent', p_deletion_mode = 'child' and v_legacy_registration_code is not null
    )
  );

  return jsonb_build_object(
    'deleted', true,
    'mode', p_deletion_mode,
    'deleted_application_ids', v_target_application_ids,
    'deleted_registration_codes', v_registration_codes,
    'deleted_applications', v_deleted_applications,
    'deleted_registrations', v_deleted_registrations,
    'deleted_intermediaries', v_deleted_intermediaries
  );
end;
$$;

revoke all on function public.delete_intermediary_account_v1(uuid, text, uuid, uuid[]) from public;
revoke all on function public.delete_intermediary_account_v1(uuid, text, uuid, uuid[]) from anon;
revoke all on function public.delete_intermediary_account_v1(uuid, text, uuid, uuid[]) from authenticated;
grant execute on function public.delete_intermediary_account_v1(uuid, text, uuid, uuid[]) to service_role;

commit;
