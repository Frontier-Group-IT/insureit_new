begin;

create or replace function public.attach_legacy_partner_record_after_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_legacy boolean;
begin
  v_is_legacy :=
    coalesce(new.source, '') = 'legacy_manual'
    or coalesce(new.draft_data->>'onboarding_mode', '') = 'legacy_existing_partner'
    or nullif(new.draft_data->>'legacy_partner_code', '') is not null
    or exists (
      select 1
      from public.posp_misp_onboarding_profiles p
      where p.application_id = new.id
        and (
          coalesce(p.record_source, '') = 'legacy_manual'
          or nullif(p.raw_data->>'legacy_partner_code', '') is not null
          or nullif(p.existing_registration_code, '') is not null
        )
    );

  if new.partner_status = 'active_partner'
     and new.partner_record_id is null
     and v_is_legacy then
    perform public.ensure_legacy_partner_record(new.id, new.initiated_by);
  end if;

  return new;
end;
$$;

drop trigger if exists attach_legacy_partner_record_after_activation on public.intermediary_onboarding_applications;
create trigger attach_legacy_partner_record_after_activation
after insert or update of partner_status on public.intermediary_onboarding_applications
for each row execute function public.attach_legacy_partner_record_after_activation();

-- Repair all previously activated legacy Partners, including applications whose
-- source was stored as manual/partner_account instead of legacy_manual.
do $$
declare
  v_row record;
begin
  for v_row in
    select a.id, a.initiated_by
    from public.intermediary_onboarding_applications a
    join public.posp_misp_onboarding_profiles p on p.application_id = a.id
    where a.partner_status = 'active_partner'
      and a.partner_record_id is null
      and (
        coalesce(a.source, '') = 'legacy_manual'
        or coalesce(a.draft_data->>'onboarding_mode', '') = 'legacy_existing_partner'
        or nullif(a.draft_data->>'legacy_partner_code', '') is not null
        or coalesce(p.record_source, '') = 'legacy_manual'
        or nullif(p.raw_data->>'legacy_partner_code', '') is not null
        or nullif(p.existing_registration_code, '') is not null
      )
  loop
    perform public.ensure_legacy_partner_record(v_row.id, v_row.initiated_by);
  end loop;
end;
$$;

commit;
