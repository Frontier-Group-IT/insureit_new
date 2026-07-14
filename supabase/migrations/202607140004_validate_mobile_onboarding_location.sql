-- Keep the applied submission function's extension lookup explicit and validate
-- customer-app location snapshots before an application reaches review.

alter function public.submit_individual_onboarding_application(uuid, text, text, text, text, text, text, uuid, text, text, text, text, boolean, text, text)
  set search_path = public, extensions;

create or replace function public.validate_mobile_onboarding_location()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  location_id text;
begin
  if new.source <> 'customer_app'
    or new.partner_type <> 'individual_proprietor'
    or new.status <> 'submitted'
  then
    return new;
  end if;

  location_id := nullif(new.draft_data ->> 'india_location_id', '');
  if location_id is null or not exists (
    select 1
    from public.india_locations location
    where location.id::text = location_id
      and location.city_name = new.draft_data ->> 'city'
      and location.state_name = new.draft_data ->> 'state'
      and location.pincode = new.draft_data ->> 'postal_code'
  ) then
    raise exception 'The selected city does not match the PIN code.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_mobile_onboarding_location on public.customer_onboarding_applications;
create trigger validate_mobile_onboarding_location
before insert or update of status, draft_data, partner_type
on public.customer_onboarding_applications
for each row execute function public.validate_mobile_onboarding_location();
