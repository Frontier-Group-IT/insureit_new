begin;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  partner_code text not null unique,
  partner_kind text not null check (partner_kind in ('individual','business')),
  display_name text not null,
  legal_name text,
  mobile text,
  email text,
  pan_number text,
  gst_number text,
  city text,
  state text,
  postal_code text,
  partner_status text not null default 'active_partner',
  portal_access_status text not null default 'not_created',
  source_application_id uuid not null unique references public.intermediary_onboarding_applications(id) on delete restrict,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partners_kind_status_check check (partner_status in ('pending_partner','active_partner','suspended_partner','inactive_partner','rejected'))
);

create unique index if not exists partners_pan_unique
  on public.partners (upper(pan_number))
  where pan_number is not null and btrim(pan_number) <> '';

create unique index if not exists partners_gst_unique
  on public.partners (upper(gst_number))
  where gst_number is not null and btrim(gst_number) <> '';

create table if not exists public.intermediary_registrations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partners(id) on delete restrict,
  application_id uuid not null unique references public.intermediary_onboarding_applications(id) on delete restrict,
  registration_type text not null check (registration_type in ('posp','misp')),
  registration_code text unique,
  registration_status text not null default 'onboarding_started',
  training_status text,
  exam_status text,
  agreement_status text,
  iib_status text,
  iib_reference text,
  activated_at timestamptz,
  suspended_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.intermediary_onboarding_applications
  add column if not exists partner_record_id uuid references public.partners(id) on delete restrict,
  add column if not exists registration_record_id uuid references public.intermediary_registrations(id) on delete restrict;

alter table public.posp_misp_onboarding_profiles
  add column if not exists partner_record_id uuid references public.partners(id) on delete restrict,
  add column if not exists registration_record_id uuid references public.intermediary_registrations(id) on delete restrict;

create sequence if not exists public.partner_code_sequence start 1;
create sequence if not exists public.posp_code_sequence start 1;
create sequence if not exists public.misp_code_sequence start 1;

create or replace function public.next_partner_code()
returns text
language sql
security definer
set search_path = public
as $$
  select 'PART-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.partner_code_sequence')::text, 5, '0');
$$;

create or replace function public.next_registration_code(p_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_type = 'posp' then
    return 'POSP-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.posp_code_sequence')::text, 5, '0');
  elsif p_type = 'misp' then
    return 'MISP-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.misp_code_sequence')::text, 5, '0');
  end if;
  raise exception 'Unsupported registration type: %', p_type;
end;
$$;

create or replace function public.validate_partner_registration_kind()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_kind text;
begin
  select partner_kind into v_kind from public.partners where id = new.partner_id;
  if v_kind is null then
    raise exception 'Partner not found';
  end if;
  if new.registration_type = 'posp' and v_kind <> 'individual' then
    raise exception 'POSP registration requires an individual Partner';
  end if;
  if new.registration_type = 'misp' and v_kind <> 'business' then
    raise exception 'MISP registration requires a business Partner';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_partner_registration_kind_trigger on public.intermediary_registrations;
create trigger validate_partner_registration_kind_trigger
before insert or update of partner_id, registration_type on public.intermediary_registrations
for each row execute function public.validate_partner_registration_kind();

create or replace function public.issue_partner_identity(p_application_id uuid, p_actor_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.intermediary_onboarding_applications%rowtype;
  v_profile public.posp_misp_onboarding_profiles%rowtype;
  v_partner public.partners%rowtype;
  v_registration public.intermediary_registrations%rowtype;
  v_kind text;
  v_name text;
  v_pan text;
  v_email text;
  v_mobile text;
begin
  select * into v_app
  from public.intermediary_onboarding_applications
  where id = p_application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if v_app.requested_type not in ('posp','misp') then raise exception 'Invalid requested intermediary type'; end if;

  select * into v_profile
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then raise exception 'Onboarding profile not found'; end if;

  if v_app.partner_record_id is not null then
    select * into v_partner from public.partners where id = v_app.partner_record_id;
    return v_partner.partner_code;
  end if;

  v_kind := case when v_app.requested_type = 'posp' then 'individual' else 'business' end;
  v_name := coalesce(nullif(btrim(case when v_app.requested_type = 'misp' then v_profile.misp_name else v_profile.pos_name end), ''), 'Unnamed Partner');
  v_pan := nullif(upper(btrim(case when v_app.requested_type = 'misp' then coalesce(v_profile.pan_number, v_profile.dp_pan_number) else v_profile.pan_number end)), '');
  v_email := nullif(lower(btrim(case when v_app.requested_type = 'misp' then coalesce(v_profile.dp_email, v_profile.applicant_email) else v_profile.applicant_email end)), '');
  v_mobile := nullif(btrim(case when v_app.requested_type = 'misp' then coalesce(v_profile.dp_phone, v_profile.applicant_phone) else v_profile.applicant_phone end), '');

  insert into public.partners (
    partner_code, partner_kind, display_name, legal_name, mobile, email, pan_number, gst_number,
    city, state, postal_code, partner_status, portal_access_status, source_application_id, created_by
  ) values (
    public.next_partner_code(), v_kind, v_name,
    case when v_kind = 'business' then v_name else null end,
    v_mobile, v_email, v_pan, nullif(upper(btrim(v_profile.gst_number)), ''),
    v_profile.city, v_profile.state, v_profile.postal_code,
    'active_partner', 'not_created', p_application_id, p_actor_id
  ) returning * into v_partner;

  insert into public.intermediary_registrations (
    partner_id, application_id, registration_type, registration_status,
    training_status, exam_status, agreement_status, iib_status, created_by
  ) values (
    v_partner.id, p_application_id, v_app.requested_type, 'onboarding_started',
    case when v_app.requested_type = 'posp' then 'not_assigned' else null end,
    case when v_app.requested_type = 'posp' then 'not_allotted' else null end,
    'not_started', 'pending', p_actor_id
  ) returning * into v_registration;

  update public.intermediary_onboarding_applications
  set partner_record_id = v_partner.id,
      registration_record_id = v_registration.id,
      final_type = v_app.requested_type,
      partner_status = 'active_partner',
      updated_at = now()
  where id = p_application_id;

  update public.posp_misp_onboarding_profiles
  set partner_record_id = v_partner.id,
      registration_record_id = v_registration.id,
      partner_id = v_partner.partner_code,
      final_account_type = v_app.requested_type,
      partner_status = 'active_partner',
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id;

  return v_partner.partner_code;
end;
$$;

create or replace function public.sync_intermediary_registration_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_type text;
begin
  if new.registration_record_id is null then return new; end if;

  select registration_type into v_type
  from public.intermediary_registrations
  where id = new.registration_record_id;

  if new.registration_status = 'iib_registered' then
    select registration_code into v_code
    from public.intermediary_registrations
    where id = new.registration_record_id;
    if v_code is null then v_code := public.next_registration_code(v_type); end if;
  end if;

  update public.intermediary_registrations
  set registration_status = new.registration_status,
      registration_code = coalesce(v_code, registration_code),
      activated_at = case when new.registration_status = 'iib_registered' then coalesce(activated_at, now()) else activated_at end,
      updated_at = now()
  where id = new.registration_record_id;

  return new;
end;
$$;

drop trigger if exists sync_intermediary_registration_application_trigger on public.intermediary_onboarding_applications;
create trigger sync_intermediary_registration_application_trigger
after update of registration_status on public.intermediary_onboarding_applications
for each row execute function public.sync_intermediary_registration_from_application();

alter table public.partners enable row level security;
alter table public.intermediary_registrations enable row level security;

commit;
