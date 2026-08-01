begin;

-- Keep the canonical Partner row linked to the source onboarding application.
create or replace function public.sync_partner_source_application_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source_application_id is not null then
    update public.intermediary_onboarding_applications
       set partner_record_id = new.id,
           updated_at = now()
     where id = new.source_application_id
       and partner_record_id is distinct from new.id;

    update public.posp_misp_onboarding_profiles
       set partner_record_id = new.id,
           updated_at = now()
     where application_id = new.source_application_id
       and partner_record_id is distinct from new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_partner_source_application_link on public.partners;
create trigger sync_partner_source_application_link
after insert or update of source_application_id on public.partners
for each row execute function public.sync_partner_source_application_link();

-- Repair all Partner applications whose canonical Partner row already exists,
-- but the onboarding application/profile still has a null partner_record_id.
update public.intermediary_onboarding_applications a
   set partner_record_id = p.id,
       updated_at = now()
  from public.partners p
 where p.source_application_id = a.id
   and a.partner_record_id is distinct from p.id;

update public.posp_misp_onboarding_profiles pr
   set partner_record_id = p.id,
       updated_at = now()
  from public.partners p
 where p.source_application_id = pr.application_id
   and pr.partner_record_id is distinct from p.id;

-- Additional fallback for legacy records created before source_application_id
-- was consistently used: match the permanent Partner code.
update public.intermediary_onboarding_applications a
   set partner_record_id = p.id,
       updated_at = now()
  from public.posp_misp_onboarding_profiles pr
  join public.partners p
    on upper(trim(p.partner_code)) = upper(trim(pr.partner_id))
 where pr.application_id = a.id
   and a.partner_status = 'active_partner'
   and a.partner_record_id is null
   and pr.partner_id is not null
   and pr.partner_id not like 'PENDING-%';

update public.posp_misp_onboarding_profiles pr
   set partner_record_id = p.id,
       updated_at = now()
  from public.partners p
 where pr.partner_record_id is null
   and pr.partner_id is not null
   and pr.partner_id not like 'PENDING-%'
   and upper(trim(p.partner_code)) = upper(trim(pr.partner_id));

commit;
