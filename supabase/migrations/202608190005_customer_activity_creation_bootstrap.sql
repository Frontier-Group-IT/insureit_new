-- Prevent Policy Onboarding bootstrap updates immediately after customer creation
-- from being presented as manual Customer Edited activity.
--
-- Existing audit rows remain append-only. The application resolver filters the
-- historical creation-time bootstrap rows already present in audit_logs.

create or replace function public.audit_customer_business_edit()
returns trigger
language plpgsql
as $function$
declare
  old_business jsonb;
  new_business jsonb;
  changed_keys text[];
begin
  old_business := to_jsonb(old) - array[
    'updated_at',
    'updated_by',
    'creation_channel',
    'origin_customer_id',
    'onboarding_status',
    'onboarding_completed_at'
  ]::text[];

  new_business := to_jsonb(new) - array[
    'updated_at',
    'updated_by',
    'creation_channel',
    'origin_customer_id',
    'onboarding_status',
    'onboarding_completed_at'
  ]::text[];

  if old_business is distinct from new_business then
    select array_agg(key order by key)
      into changed_keys
    from (
      select key from jsonb_object_keys(old_business) as key
      union
      select key from jsonb_object_keys(new_business) as key
    ) keys
    where coalesce(old_business -> key, 'null'::jsonb)
      is distinct from coalesce(new_business -> key, 'null'::jsonb);

    if new.updated_by is null
      and new.created_at is not null
      and abs(extract(epoch from (clock_timestamp() - new.created_at))) <= 60
      and coalesce(array_length(changed_keys, 1), 0) > 0
      and changed_keys <@ array['partner_type', 'lead_source_intermediary_id']::text[]
    then
      return new;
    end if;

    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    values (new.updated_by, 'customer_edited', 'customers', new.id, old_business, new_business);
  end if;

  return new;
end;
$function$;
