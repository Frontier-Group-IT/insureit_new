begin;

create or replace function public.partner_app_registration_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_identity jsonb;
  v_portal_account_id uuid;
  v_intermediary_id uuid;
  v_primary_application_id uuid;
  v_primary_registration_status text;
  v_primary_status text;
  v_primary_final_type text;
  v_primary_partner_record_id uuid;
  v_qualification_application_id uuid;
  v_qualification_registration_status text;
  v_qualification_status text;
  v_qualification_final_type text;
  v_intermediary jsonb;
  v_assignment jsonb;
  v_document_count integer := 0;
  v_documents jsonb := '[]'::jsonb;
begin
  v_identity := public.partner_app_current_identity();

  if v_identity is null or v_identity ->> 'actor_kind' <> 'intermediary' then
    raise exception 'INSUREIT Partner registration access is unavailable'
      using errcode = '28000';
  end if;

  v_portal_account_id := nullif(v_identity ->> 'portal_account_id', '')::uuid;
  v_intermediary_id := nullif(v_identity ->> 'intermediary_id', '')::uuid;

  select ipa.application_id
  into v_primary_application_id
  from public.intermediary_portal_accounts ipa
  where ipa.id = v_portal_account_id
    and ipa.auth_user_id = auth.uid()
    and ipa.status = 'active'
  limit 1;

  if v_primary_application_id is null then
    raise exception 'Partner registration application is unavailable'
      using errcode = '28000';
  end if;

  select jsonb_build_object(
    'id', i.id,
    'display_name', i.display_name,
    'intermediary_type', i.intermediary_type,
    'intermediary_code', i.intermediary_code,
    'mobile', i.mobile,
    'email', i.email,
    'account_status', i.account_status,
    'portal_access_status', i.portal_access_status,
    'activated_at', i.activated_at
  )
  into v_intermediary
  from public.intermediaries i
  where i.id = v_intermediary_id;

  select
    app.registration_status,
    app.status,
    app.final_type,
    app.partner_record_id
  into
    v_primary_registration_status,
    v_primary_status,
    v_primary_final_type,
    v_primary_partner_record_id
  from public.intermediary_onboarding_applications app
  where app.id = v_primary_application_id;

  if not found then
    raise exception 'Partner registration application is unavailable'
      using errcode = '28000';
  end if;

  if v_primary_final_type in ('posp', 'misp') then
    v_qualification_application_id := v_primary_application_id;
  elsif v_primary_final_type = 'partner' and v_primary_partner_record_id is not null then
    select app.id
    into v_qualification_application_id
    from public.intermediary_onboarding_applications app
    where app.partner_record_id = v_primary_partner_record_id
      and app.final_type in ('posp', 'misp')
    order by app.updated_at desc, app.id desc
    limit 1;
  end if;

  if v_qualification_application_id is not null then
    select
      app.registration_status,
      app.status,
      app.final_type
    into
      v_qualification_registration_status,
      v_qualification_status,
      v_qualification_final_type
    from public.intermediary_onboarding_applications app
    where app.id = v_qualification_application_id;

    select jsonb_build_object(
      'training_title', a.training_title,
      'training_deadline', a.training_deadline,
      'training_status', a.training_status,
      'exam_title', a.exam_title,
      'exam_status', a.exam_status,
      'exam_score', a.exam_score,
      'exam_attempts_used', a.exam_attempts_used,
      'maximum_attempts', a.maximum_attempts,
      'agreement_status', a.agreement_status,
      'iib_registration_status', a.iib_registration_status
    )
    into v_assignment
    from public.intermediary_training_exam_assignments a
    where a.application_id = v_qualification_application_id;
  end if;

  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'document_type', d.document_type,
          'file_name', d.file_name,
          'storage_bucket', d.storage_bucket,
          'storage_path', d.storage_path,
          'mime_type', d.mime_type,
          'file_size', d.file_size,
          'verification_status', d.verification_status,
          'created_at', d.created_at
        )
        order by d.created_at asc, d.id asc
      ),
      '[]'::jsonb
    )
  into v_document_count, v_documents
  from public.intermediary_onboarding_documents d
  where d.application_id = v_primary_application_id;

  return jsonb_build_object(
    'generated_at', now(),
    'intermediary', v_intermediary,
    'primary_application', jsonb_build_object(
      'id', v_primary_application_id,
      'registration_status', v_primary_registration_status,
      'status', v_primary_status,
      'final_type', v_primary_final_type
    ),
    'document_count', v_document_count,
    'documents', v_documents,
    'qualification_application',
      case
        when v_qualification_application_id is null then null
        else jsonb_build_object(
          'id', v_qualification_application_id,
          'registration_status', v_qualification_registration_status,
          'status', v_qualification_status,
          'final_type', v_qualification_final_type
        )
      end,
    'assignment', v_assignment
  );
end;
$$;

revoke all on function public.partner_app_registration_overview() from public, anon;
grant execute on function public.partner_app_registration_overview() to authenticated, service_role;

drop policy if exists "Partner portal users can read own intermediary onboarding files" on storage.objects;

create policy "Partner portal users can read own intermediary onboarding files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-documents'
  and exists (
    select 1
    from public.intermediary_onboarding_documents d
    join public.intermediary_portal_accounts ipa
      on ipa.application_id = d.application_id
    where d.storage_bucket = objects.bucket_id
      and d.storage_path = objects.name
      and ipa.auth_user_id = auth.uid()
      and ipa.status = 'active'
  )
);

commit;
