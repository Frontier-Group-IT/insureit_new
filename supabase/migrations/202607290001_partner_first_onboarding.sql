begin;

create sequence if not exists public.partner_application_reference_seq start with 1 increment by 1;
create sequence if not exists public.partner_identity_seq start with 1 increment by 1;
create sequence if not exists public.posp_identity_seq start with 1 increment by 1;

alter table if exists public.intermediary_onboarding_applications
  add column if not exists application_reference text,
  add column if not exists partner_status text default 'draft',
  add column if not exists partner_activated_at timestamptz,
  add column if not exists posp_conversion_requested_at timestamptz;

alter table if exists public.posp_misp_onboarding_profiles
  add column if not exists partner_id text,
  add column if not exists posp_id text,
  add column if not exists partner_status text default 'draft',
  add column if not exists partner_activated_at timestamptz,
  add column if not exists posp_conversion_requested_at timestamptz,
  add column if not exists iib_match_warning_acknowledged boolean not null default false,
  add column if not exists iib_match_warning_acknowledged_at timestamptz,
  add column if not exists iib_match_warning_acknowledged_by uuid,
  add column if not exists iib_match_warning_text text;

create unique index if not exists intermediary_onboarding_applications_application_reference_uidx
  on public.intermediary_onboarding_applications(application_reference)
  where application_reference is not null;

create unique index if not exists posp_misp_onboarding_profiles_partner_id_uidx
  on public.posp_misp_onboarding_profiles(partner_id)
  where partner_id is not null;

create unique index if not exists posp_misp_onboarding_profiles_posp_id_uidx
  on public.posp_misp_onboarding_profiles(posp_id)
  where posp_id is not null;

create unique index if not exists posp_misp_onboarding_profiles_partner_pan_uidx
  on public.posp_misp_onboarding_profiles(upper(pan_number))
  where partner_id is not null and pan_number is not null;

create unique index if not exists posp_misp_onboarding_profiles_partner_aadhaar_uidx
  on public.posp_misp_onboarding_profiles(aadhaar_hash)
  where partner_id is not null and aadhaar_hash is not null;

create or replace function public.next_partner_application_reference()
returns text
language sql
security definer
set search_path = public
as $$
  select 'APP-' || extract(year from now())::int || '-' || lpad(nextval('public.partner_application_reference_seq')::text, 5, '0');
$$;

create or replace function public.next_partner_identity()
returns text
language sql
security definer
set search_path = public
as $$
  select 'PART-' || extract(year from now())::int || '-' || lpad(nextval('public.partner_identity_seq')::text, 5, '0');
$$;

create or replace function public.next_posp_identity()
returns text
language sql
security definer
set search_path = public
as $$
  select 'POSP-' || extract(year from now())::int || '-' || lpad(nextval('public.posp_identity_seq')::text, 5, '0');
$$;

create or replace function public.issue_partner_identity(p_application_id uuid, p_actor_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id text;
  v_pan text;
  v_aadhaar_hash text;
  v_existing uuid;
begin
  select pan_number, aadhaar_hash, partner_id
    into v_pan, v_aadhaar_hash, v_partner_id
  from public.posp_misp_onboarding_profiles
  where application_id = p_application_id
  for update;

  if not found then raise exception 'Onboarding profile not found'; end if;
  if v_partner_id is not null then return v_partner_id; end if;
  if v_pan is null or v_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'A valid PAN is required'; end if;
  if v_aadhaar_hash is null then raise exception 'A valid Aadhaar is required'; end if;

  select application_id into v_existing
  from public.posp_misp_onboarding_profiles
  where upper(pan_number) = upper(v_pan) and application_id <> p_application_id and partner_id is not null
  limit 1;
  if v_existing is not null then raise exception 'A Partner already exists with this PAN'; end if;

  v_existing := null;
  select application_id into v_existing
  from public.posp_misp_onboarding_profiles
  where aadhaar_hash = v_aadhaar_hash and application_id <> p_application_id and partner_id is not null
  limit 1;
  if v_existing is not null then raise exception 'A Partner already exists with this Aadhaar'; end if;

  v_partner_id := public.next_partner_identity();

  update public.posp_misp_onboarding_profiles
  set partner_id = v_partner_id,
      partner_status = 'active_partner',
      partner_activated_at = now(),
      final_account_type = 'partner',
      updated_by = p_actor_id,
      updated_at = now()
  where application_id = p_application_id;

  update public.intermediary_onboarding_applications
  set final_type = 'partner',
      partner_status = 'active_partner',
      partner_activated_at = now(),
      registration_status = 'partner_active',
      updated_at = now()
  where id = p_application_id;

  insert into public.intermediaries(application_id, intermediary_type, intermediary_code, account_status, registration_status, created_at, updated_at)
  values (p_application_id, 'partner', v_partner_id, 'active', 'partner_active', now(), now())
  on conflict (intermediary_code) do nothing;

  return v_partner_id;
end;
$$;

create table if not exists public.business_referral_identities (
  id uuid primary key default gen_random_uuid(),
  business_record_type text not null,
  business_record_id uuid not null,
  intermediary_application_id uuid not null references public.intermediary_onboarding_applications(id),
  referral_identity_type text not null check (referral_identity_type in ('partner','posp')),
  referral_identity_code text not null,
  selected_by uuid,
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (business_record_type, business_record_id)
);

create index if not exists business_referral_identities_application_idx
  on public.business_referral_identities(intermediary_application_id);

commit;
