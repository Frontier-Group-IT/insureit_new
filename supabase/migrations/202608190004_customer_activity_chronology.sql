-- Prevent automatic onboarding-state maintenance from being presented as a manual Customer Edited action.
-- Existing audit rows are preserved; the application activity resolver filters historical status-only rows.

create or replace function public.audit_customer_business_edit()
returns trigger
language plpgsql
as $function$
declare
  old_business jsonb;
  new_business jsonb;
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
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    values (new.updated_by, 'customer_edited', 'customers', new.id, old_business, new_business);
  end if;

  return new;
end;
$function$;
