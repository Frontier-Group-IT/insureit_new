-- Persist auditable consent for customer service enquiries.

alter table public.service_enquiries
  add column if not exists consent_accepted boolean not null default false,
  add column if not exists consent_accepted_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists terms_version text,
  add column if not exists privacy_policy_version text,
  add column if not exists whatsapp_opt_in boolean not null default false;

alter table public.service_enquiries
  drop constraint if exists service_enquiries_consent_consistency;

alter table public.service_enquiries
  add constraint service_enquiries_consent_consistency
  check (
    (consent_accepted = false and consent_accepted_at is null)
    or
    (
      consent_accepted = true
      and consent_accepted_at is not null
      and nullif(btrim(consent_version), '') is not null
      and nullif(btrim(terms_version), '') is not null
      and nullif(btrim(privacy_policy_version), '') is not null
    )
  );

create index if not exists service_enquiries_consent_created_idx
  on public.service_enquiries(consent_accepted, created_at desc);
