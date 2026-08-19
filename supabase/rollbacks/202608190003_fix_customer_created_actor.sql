begin;

-- Restore the prior provenance-audit function semantics. Correction markers
-- remain in audit_logs because customer activity history is append-only.
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
      coalesce(new.updated_by, new.created_by),
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

commit;
