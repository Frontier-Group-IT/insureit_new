begin;

alter table public.customer_onboarding_applications
  add column if not exists migrated_to_intermediary_at timestamptz,
  add column if not exists migrated_intermediary_application_id uuid;

update public.customer_onboarding_applications customer_app
set migrated_to_intermediary_at=coalesce(customer_app.migrated_to_intermediary_at,now()),
    migrated_intermediary_application_id=intermediary_app.id
from public.intermediary_onboarding_applications intermediary_app
where intermediary_app.id=customer_app.id
  and customer_app.partner_type in('posp','misp');

create or replace function public.prevent_intermediary_customer_application_insert()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.partner_type in('posp','misp') and (tg_op='INSERT' or old.partner_type is distinct from new.partner_type) then
    raise exception 'POSP and MISP applications must be created in intermediary_onboarding_applications, not customer_onboarding_applications.' using errcode='23514';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_intermediary_customer_application_insert on public.customer_onboarding_applications;
create trigger prevent_intermediary_customer_application_insert
before insert or update of partner_type on public.customer_onboarding_applications
for each row execute function public.prevent_intermediary_customer_application_insert();

create or replace view public.intermediary_onboarding_cutover_audit as
select
  intermediary.id,
  intermediary.requested_type,
  intermediary.status,
  intermediary.created_at,
  exists(select 1 from public.posp_misp_onboarding_profiles profile where profile.application_id=intermediary.id) as has_profile,
  (select count(*) from public.intermediary_onboarding_contacts contact where contact.application_id=intermediary.id) as contact_count,
  (select count(*) from public.intermediary_onboarding_documents document where document.application_id=intermediary.id) as document_count,
  exists(select 1 from public.customer_onboarding_applications legacy where legacy.id=intermediary.id) as has_historical_customer_copy,
  exists(select 1 from public.pan_verification_jobs job where job.application_id=intermediary.id) as has_pan_job
from public.intermediary_onboarding_applications intermediary;

comment on view public.intermediary_onboarding_cutover_audit is 'Operational verification view for the staged intermediary onboarding cutover.';

commit;
