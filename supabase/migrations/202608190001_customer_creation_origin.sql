begin;

alter table public.customers
  add column if not exists creation_channel text not null default 'legacy',
  add column if not exists origin_customer_id uuid null;

alter table public.customers
  drop constraint if exists customers_creation_channel_check;

alter table public.customers
  add constraint customers_creation_channel_check
  check (
    creation_channel in (
      'legacy',
      'direct_customer_onboarding',
      'policy_onboarding',
      'group_onboarding',
      'corporate_onboarding',
      'dealership_onboarding',
      'group_customer_onboarding',
      'corporate_customer_onboarding',
      'dealership_customer_onboarding'
    )
  );

alter table public.customers
  drop constraint if exists customers_origin_customer_id_fkey;

alter table public.customers
  add constraint customers_origin_customer_id_fkey
  foreign key (origin_customer_id)
  references public.customers(id)
  on delete set null;

create index if not exists customers_creation_channel_idx
  on public.customers (creation_channel);

create index if not exists customers_origin_customer_id_idx
  on public.customers (origin_customer_id)
  where origin_customer_id is not null;

create or replace function public.protect_customer_creation_provenance()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.creation_channel = 'legacy' then
      new.creation_channel := case new.partner_type
        when 'group' then 'group_onboarding'
        when 'corporate' then 'corporate_onboarding'
        when 'dealership' then 'dealership_onboarding'
        else 'legacy'
      end;
    end if;
    return new;
  end if;

  -- Once a reliable creation source is known, later edits or membership
  -- changes cannot rewrite the customer's original provenance.
  if old.creation_channel <> 'legacy' then
    new.creation_channel := old.creation_channel;
    new.origin_customer_id := old.origin_customer_id;
    return new;
  end if;

  if new.creation_channel = 'legacy' then
    new.origin_customer_id := old.origin_customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_customer_creation_provenance on public.customers;
create trigger protect_customer_creation_provenance
before insert or update of creation_channel, origin_customer_id on public.customers
for each row execute function public.protect_customer_creation_provenance();

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

drop trigger if exists audit_customer_creation_provenance on public.customers;
create trigger audit_customer_creation_provenance
after insert or update of creation_channel on public.customers
for each row execute function public.audit_customer_creation_provenance();

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

drop trigger if exists audit_customer_business_edit on public.customers;
create trigger audit_customer_business_edit
after update on public.customers
for each row execute function public.audit_customer_business_edit();

create or replace function public.classify_direct_customer_onboarding()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved'
    and new.customer_id is not null
    and new.partner_type = 'individual_proprietor'
    and (old.status is distinct from new.status or old.customer_id is distinct from new.customer_id) then
    update public.customers
    set creation_channel = 'direct_customer_onboarding'
    where id = new.customer_id
      and creation_channel = 'legacy';
  end if;
  return new;
end;
$$;

drop trigger if exists classify_direct_customer_onboarding on public.customer_onboarding_applications;
create trigger classify_direct_customer_onboarding
after update of status, customer_id on public.customer_onboarding_applications
for each row execute function public.classify_direct_customer_onboarding();

create or replace function public.classify_policy_onboarded_customer()
returns trigger
language plpgsql
as $$
begin
  update public.customers c
  set creation_channel = 'policy_onboarding'
  where c.id = new.customer_id
    and c.creation_channel = 'legacy'
    and c.created_at >= coalesce(new.created_at, now()) - interval '10 minutes';
  return new;
end;
$$;

drop trigger if exists classify_policy_onboarded_customer on public.policies;
create trigger classify_policy_onboarded_customer
after insert on public.policies
for each row execute function public.classify_policy_onboarded_customer();

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

    -- Only classify the parent as the immutable creation origin when the
    -- relationship is established as part of creating a brand-new customer.
    -- Linking an older existing customer later remains relationship history
    -- and never rewrites that customer's creation source.
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

drop trigger if exists audit_customer_parent_relationship on public.customer_relationships;
create trigger audit_customer_parent_relationship
after insert or update of is_active, status on public.customer_relationships
for each row execute function public.audit_customer_parent_relationship();

comment on column public.customers.creation_channel is
  'Immutable creation workflow for the customer. Existing rows remain legacy unless a reliable origin is known.';

comment on column public.customers.origin_customer_id is
  'Customer account (group/corporate/dealership) under which this customer was originally created. This is creation provenance, not current membership.';

commit;
