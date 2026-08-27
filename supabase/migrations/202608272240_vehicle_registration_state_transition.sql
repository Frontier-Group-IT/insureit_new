-- Vehicle Master registration state must control temporary versus real registration identity.
-- A pending vehicle keeps a chassis-derived NEW-* reference; a registered vehicle keeps
-- the normalized registration number and vehicle_no_normalized in sync.

create or replace function public.sync_pending_vehicle_no_from_chassis()
returns trigger
language plpgsql
as $$
declare
  normalized_chassis text;
  normalized_registration text;
begin
  if new.registration_status = 'registration_pending' then
    normalized_chassis := regexp_replace(upper(coalesce(new.chassis_no, '')), '[^A-Z0-9]', '', 'g');

    if normalized_chassis <> '' then
      new.vehicle_no := 'NEW-' || normalized_chassis;
      new.vehicle_no_normalized := null;
    end if;
  elsif coalesce(new.vehicle_no, '') !~* '^(NEW|PENDING)-' then
    normalized_registration := regexp_replace(upper(coalesce(new.vehicle_no, '')), '[^A-Z0-9]', '', 'g');

    if normalized_registration <> '' then
      new.vehicle_no := normalized_registration;
      new.vehicle_no_normalized := normalized_registration;
    end if;
  end if;

  return new;
end;
$$;
