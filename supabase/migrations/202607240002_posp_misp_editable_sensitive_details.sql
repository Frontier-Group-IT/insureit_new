-- Allow flexible operational IDs and retain full POSP/MISP Aadhaar values encrypted.
-- Aadhaar ciphertext is decrypted only by the authorized server-side review workflow.

alter table public.posp_misp_onboarding_profiles
  add column if not exists aadhaar_number_encrypted text;

comment on column public.posp_misp_onboarding_profiles.aadhaar_number_encrypted is
  'AES-GCM encrypted Aadhaar number for authorized POSP/MISP verification. Never expose in list APIs.';

create or replace function public.validate_posp_misp_external_onboarding_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.external_onboarding_id := nullif(upper(btrim(new.external_onboarding_id)), '');
  if new.external_onboarding_id is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.external_onboarding_id, 0));
  if exists (
    select 1
    from public.posp_misp_onboarding_profiles profile
    where profile.external_onboarding_id = new.external_onboarding_id
      and profile.id <> new.id
  ) then
    raise exception 'External onboarding ID already exists.';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_posp_misp_external_onboarding_id() from public;
