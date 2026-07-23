-- Normalize operational POSP/MISP workflow fields.
-- External onboarding IDs remain manual/imported for now.

alter table public.posp_misp_onboarding_profiles
  add column if not exists associate_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists iib_uploaded boolean not null default false,
  add column if not exists training_credentials_shared_flag boolean not null default false;

update public.posp_misp_onboarding_profiles
set
  iib_uploaded = lower(coalesce(iib_upload_status, '')) = 'uploaded',
  iib_upload_status = case when lower(coalesce(iib_upload_status, '')) = 'uploaded' then 'uploaded' else 'pending' end,
  iib_remarks = case
    when iib_remarks in ('Matching Record Found In DataBase', 'No Data Found In POS System') then iib_remarks
    else null
  end,
  training_credentials_shared_flag = lower(coalesce(training_credentials_shared, '')) in ('yes', 'true', 'shared', 'done', 'complete', 'completed');

alter table public.posp_misp_onboarding_profiles
  drop constraint if exists posp_misp_profiles_iib_remarks_check;

alter table public.posp_misp_onboarding_profiles
  add constraint posp_misp_profiles_iib_remarks_check
  check (
    iib_remarks is null
    or iib_remarks in (
      'Matching Record Found In DataBase',
      'No Data Found In POS System'
    )
  );

alter table public.posp_misp_onboarding_profiles
  drop constraint if exists posp_misp_profiles_iib_upload_status_check;

alter table public.posp_misp_onboarding_profiles
  add constraint posp_misp_profiles_iib_upload_status_check
  check (
    iib_upload_status is null
    or iib_upload_status in ('uploaded', 'pending')
  );

create index if not exists posp_misp_profiles_associate_profile_idx
  on public.posp_misp_onboarding_profiles(associate_profile_id);
