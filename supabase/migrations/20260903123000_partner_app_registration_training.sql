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
begin
  v_identity := public.partner_app_current_identity();

  if v_identity is null or v_identity ->> 'actor_kind' <> 'intermediary' then
    raise exception 'INSUREIT Partner registration access is unavailable'
      using errcode = '28000';
  end if;

  v_portal_account_id := nullif(v_identity ->> 'portal_account_id', '')::uuid;
  v_intermediary_id := nullif(v_identity ->> 'intermediary_id', '')::uuid;

  select
    ipa.application_id
  into
    v_primary_application_id
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
    'portal_access_status', i.portal_access_status
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

  select count(*)::integer
  into v_document_count
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

create or replace function public.partner_app_training_sso_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_identity jsonb;
  v_portal_account_id uuid;
  v_primary_application_id uuid;
  v_primary_final_type text;
  v_primary_partner_record_id uuid;
  v_qualification_application_id uuid;
  v_qualification_final_type text;
  v_training_login_id text;
  v_pan_number text;
  v_dp_pan_number text;
  v_login_id text;
begin
  v_identity := public.partner_app_current_identity();

  if v_identity is null or v_identity ->> 'actor_kind' <> 'intermediary' then
    raise exception 'INSUREIT Partner training access is unavailable'
      using errcode = '28000';
  end if;

  v_portal_account_id := nullif(v_identity ->> 'portal_account_id', '')::uuid;

  select ipa.application_id
  into v_primary_application_id
  from public.intermediary_portal_accounts ipa
  where ipa.id = v_portal_account_id
    and ipa.auth_user_id = auth.uid()
    and ipa.status = 'active'
  limit 1;

  if v_primary_application_id is null then
    return null;
  end if;

  select app.final_type, app.partner_record_id
  into v_primary_final_type, v_primary_partner_record_id
  from public.intermediary_onboarding_applications app
  where app.id = v_primary_application_id;

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

  if v_qualification_application_id is null then
    return null;
  end if;

  select
    p.partner_type,
    p.training_login_id,
    p.pan_number,
    p.dp_pan_number
  into
    v_qualification_final_type,
    v_training_login_id,
    v_pan_number,
    v_dp_pan_number
  from public.posp_misp_onboarding_profiles p
  where p.application_id = v_qualification_application_id
  limit 1;

  if not found then
    return null;
  end if;

  v_login_id := upper(trim(coalesce(
    nullif(v_training_login_id, ''),
    case
      when v_qualification_final_type = 'misp' then nullif(v_dp_pan_number, '')
      else nullif(v_pan_number, '')
    end
  )));

  if v_login_id is null or v_login_id !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    return jsonb_build_object(
      'available', false,
      'account_label',
        case
          when v_qualification_final_type = 'misp' then 'MISP designated person'
          else 'POSP'
        end
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'login_id', v_login_id,
    'account_label',
      case
        when v_qualification_final_type = 'misp' then 'MISP designated person'
        else 'POSP'
      end
  );
end;
$$;

revoke all on function public.partner_app_registration_overview() from public, anon;
revoke all on function public.partner_app_training_sso_context() from public, anon;

grant execute on function public.partner_app_registration_overview() to authenticated, service_role;
grant execute on function public.partner_app_training_sso_context() to authenticated, service_role;

commit;
