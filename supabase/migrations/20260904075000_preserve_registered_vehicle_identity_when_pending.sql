create or replace function public.sync_pending_vehicle_no_from_chassis()
returns trigger
language plpgsql
as $function$
declare
  normalized_chassis text;
  normalized_registration text;
begin
  if new.registration_status = 'registration_pending' then
    if tg_op = 'UPDATE'
      and old.registration_status is distinct from 'registration_pending'
      and coalesce(old.vehicle_no, '') !~* '^(NEW|PENDING)-'
    then
      normalized_registration := regexp_replace(upper(coalesce(old.vehicle_no, '')), '[^A-Z0-9]', '', 'g');

      if normalized_registration <> '' then
        new.vehicle_no := normalized_registration;
        new.vehicle_no_normalized := normalized_registration;
      end if;
    else
      normalized_chassis := regexp_replace(upper(coalesce(new.chassis_no, '')), '[^A-Z0-9]', '', 'g');

      if normalized_chassis <> '' then
        new.vehicle_no := 'NEW-' || normalized_chassis;
        new.vehicle_no_normalized := null;
      end if;
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
$function$;
