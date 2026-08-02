begin;

create or replace function public.handle_partner_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_id is not null then
    perform public.sync_partner_intermediary(new.application_id);
  end if;
  return new;
end;
$$;

revoke all on function public.handle_partner_profile_sync() from public;
revoke all on function public.handle_partner_profile_sync() from anon;
revoke all on function public.handle_partner_profile_sync() from authenticated;

drop trigger if exists trg_sync_partner_intermediary
  on public.posp_misp_onboarding_profiles;

create trigger trg_sync_partner_intermediary
after insert or update of
  partner_id,
  partner_status,
  pos_name,
  misp_name,
  applicant_phone,
  applicant_email,
  dp_name,
  dp_phone,
  dp_email,
  city
on public.posp_misp_onboarding_profiles
for each row
execute function public.handle_partner_profile_sync();

-- Reconcile existing profiles once after restoring automatic synchronization.
do $$
declare
  r record;
begin
  for r in
    select application_id
    from public.posp_misp_onboarding_profiles
    where partner_id is not null
  loop
    perform public.sync_partner_intermediary(r.application_id);
  end loop;
end;
$$;

commit;
