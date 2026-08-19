begin;

-- Restore Customer Edited audit rows to the pre-action-channel payload shape.
create or replace function public.audit_customer_business_edit()
returns trigger
language plpgsql
as $$
declare
  old_business jsonb;
  new_business jsonb;
begin
  old_business := to_jsonb(old) - array['updated_at', 'updated_by', 'creation_channel', 'origin_customer_id']::text[];
  new_business := to_jsonb(new) - array['updated_at', 'updated_by', 'creation_channel', 'origin_customer_id']::text[];

  if old_business is distinct from new_business then
    insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
    values (new.updated_by, 'customer_edited', 'customers', new.id, old_business, new_business);
  end if;
  return new;
end;
$$;

-- Restore parent relationship activity payloads without an explicit action channel.
create or replace function public.audit_customer_parent_relationship()
returns trigger
language plpgsql
as $$
declare
  parent_type text;
  child_created_at timestamptz;
  origin_channel text;
begin
  if tg_op = 'INSERT' and new.is_active and new.status = 'active' then
    select partner_type into parent_type from public.customers where id = new.parent_customer_id;
    select created_at into child_created_at from public.customers where id = new.child_customer_id;

    origin_channel := case parent_type
      when 'group' then 'group_customer_onboarding'
      when 'corporate' then 'corporate_customer_onboarding'
      when 'dealership' then 'dealership_customer_onboarding'
      else null
    end;

    if origin_channel is not null
      and child_created_at >= coalesce(new.created_at, now()) - interval '10 minutes' then
      update public.customers
      set creation_channel = origin_channel,
          origin_customer_id = new.parent_customer_id
      where id = new.child_customer_id
        and creation_channel = 'legacy';
    end if;

    insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (
      new.created_by,
      'customer_added_to_parent',
      'customers',
      new.child_customer_id,
      jsonb_build_object(
        'origin_customer_id', new.parent_customer_id,
        'relationship_type', new.relationship_type
      )
    );
  elsif tg_op = 'UPDATE'
    and old.is_active
    and old.status = 'active'
    and (not new.is_active or new.status <> 'active') then
    insert into public.audit_logs (actor_id, action, table_name, record_id, new_data)
    values (
      coalesce(new.approved_by, new.created_by),
      'customer_removed_from_parent',
      'customers',
      new.child_customer_id,
      jsonb_build_object(
        'origin_customer_id', new.parent_customer_id,
        'relationship_type', new.relationship_type
      )
    );
  end if;
  return new;
end;
$$;

commit;
