begin;

-- A Customer Created activity describes who originally created the customer,
-- not who happened to classify its creation channel later. Historical origin
-- backfills can run after an edit, so updated_by must never be used here.
create or replace function public.audit_customer_creation_provenance()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.creation_channel <> 'legacy' then
    insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (
      new.created_by,
      'customer_created',
      'customers',
      new.id,
      jsonb_strip_nulls(jsonb_build_object(
        'creation_channel', new.creation_channel,
        'origin_customer_id', new.origin_customer_id
      ))
    );
  elsif tg_op = 'UPDATE'
    and old.creation_channel = 'legacy'
    and new.creation_channel <> 'legacy' then
    insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (
      new.created_by,
      'customer_created',
      'customers',
      new.id,
      jsonb_strip_nulls(jsonb_build_object(
        'creation_channel', new.creation_channel,
        'origin_customer_id', new.origin_customer_id
      ))
    );
  end if;
  return new;
end;
$$;

-- Keep audit history append-only. Instead of rewriting the already-generated
-- Customer Created row, add a correction marker that points at the specific
-- backfill-generated activity whose actor must be displayed from customers.created_by.
insert into public.audit_logs (
  actor_id,
  action,
  table_name,
  record_id,
  old_data,
  new_data
)
select
  c.created_by,
  'customer_created_actor_corrected',
  'customers',
  created_event.record_id,
  jsonb_strip_nulls(jsonb_build_object(
    'customer_created_audit_id', created_event.id,
    'incorrect_actor_id', created_event.actor_id
  )),
  jsonb_strip_nulls(jsonb_build_object(
    'customer_created_audit_id', created_event.id,
    'correct_actor_id', c.created_by,
    'reason', 'historical_origin_backfill_used_updated_by'
  ))
from public.audit_logs marker
join public.customers c
  on c.id = marker.record_id
join public.audit_logs created_event
  on created_event.table_name = 'customers'
 and created_event.record_id = marker.record_id
 and created_event.action = 'customer_created'
 and created_event.created_at = marker.created_at
where marker.table_name = 'customers'
  and marker.action = 'customer_creation_origin_backfilled'
  and created_event.actor_id is distinct from c.created_by
  and not exists (
    select 1
    from public.audit_logs existing_correction
    where existing_correction.table_name = 'customers'
      and existing_correction.record_id = created_event.record_id
      and existing_correction.action = 'customer_created_actor_corrected'
      and existing_correction.new_data ->> 'customer_created_audit_id' = created_event.id::text
  );

commit;
