-- Customer onboarding foundation for the manager web portal and OTP-based mobile access.
-- This migration is intentionally backward-compatible with existing customer records.

alter table public.customers
  add column if not exists partner_type text,
  add column if not exists address_street text,
  add column if not exists address_locality text,
  add column if not exists india_location_id uuid,
  add column if not exists pan_number text,
  add column if not exists aadhaar_last_four text,
  add column if not exists aadhaar_hash text,
  add column if not exists legal_trade_name text,
  add column if not exists is_gst_registered boolean not null default false,
  add column if not exists gst_number text,
  add column if not exists fleet_size_band text,
  add column if not exists onboarding_completed_at timestamptz;

-- Preserve a stable location reference while retaining the readable city/state/pincode snapshot.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_india_location_id_fkey'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_india_location_id_fkey
      foreign key (india_location_id)
      references public.india_locations(id)
      on delete set null;
  end if;
end
$$;

-- Controlled values used by the dynamic onboarding form.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_partner_type_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_partner_type_check
      check (
        partner_type is null or partner_type in (
          'individual_proprietor',
          'dealership',
          'corporate',
          'group'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_fleet_size_band_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_fleet_size_band_check
      check (
        fleet_size_band is null or fleet_size_band in (
          'less_than_5',
          '5_to_20',
          '20_to_50',
          'more_than_50'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_pan_number_format_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_pan_number_format_check
      check (pan_number is null or pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_gst_number_format_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_gst_number_format_check
      check (gst_number is null or gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_aadhaar_last_four_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_aadhaar_last_four_check
      check (aadhaar_last_four is null or aadhaar_last_four ~ '^[0-9]{4}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_gst_required_fields_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_gst_required_fields_check
      check (
        is_gst_registered = false
        or (
          nullif(btrim(legal_trade_name), '') is not null
          and nullif(btrim(gst_number), '') is not null
        )
      );
  end if;
end
$$;

-- Store PAN/GST in a normalized uppercase format regardless of input casing.
create or replace function public.normalize_customer_onboarding_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone := regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g');
  new.email := nullif(lower(btrim(new.email)), '');
  new.pan_number := nullif(upper(btrim(new.pan_number)), '');
  new.gst_number := nullif(upper(btrim(new.gst_number)), '');
  new.legal_trade_name := nullif(btrim(new.legal_trade_name), '');
  new.address_street := nullif(btrim(new.address_street), '');
  new.address_locality := nullif(btrim(new.address_locality), '');
  return new;
end;
$$;

drop trigger if exists normalize_customer_onboarding_fields on public.customers;
create trigger normalize_customer_onboarding_fields
before insert or update on public.customers
for each row execute function public.normalize_customer_onboarding_fields();

-- Useful lookup indexes. Uniqueness is intentionally deferred until existing data is audited.
create index if not exists customers_partner_type_idx on public.customers(partner_type);
create index if not exists customers_fleet_size_band_idx on public.customers(fleet_size_band);
create index if not exists customers_india_location_id_idx on public.customers(india_location_id);
create index if not exists customers_phone_idx on public.customers(phone);
create index if not exists customers_pan_number_idx on public.customers(pan_number) where pan_number is not null;
create index if not exists customers_gst_number_idx on public.customers(gst_number) where gst_number is not null;
create unique index if not exists customers_aadhaar_hash_unique_idx
  on public.customers(aadhaar_hash)
  where aadhaar_hash is not null;

-- Extend existing customer document metadata for review and replacement workflows.
alter table public.customer_documents
  add column if not exists verification_status text not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists verified_by uuid,
  add column if not exists verified_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_documents_verification_status_check'
      and conrelid = 'public.customer_documents'::regclass
  ) then
    alter table public.customer_documents
      add constraint customer_documents_verification_status_check
      check (verification_status in ('pending', 'verified', 'rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customer_documents_verified_by_fkey'
      and conrelid = 'public.customer_documents'::regclass
  ) then
    alter table public.customer_documents
      add constraint customer_documents_verified_by_fkey
      foreign key (verified_by)
      references public.profiles(id)
      on delete set null;
  end if;
end
$$;

create index if not exists customer_documents_customer_id_idx
  on public.customer_documents(customer_id);
create index if not exists customer_documents_review_queue_idx
  on public.customer_documents(verification_status, created_at desc);

-- Internal users need table-level access while onboarding and reviewing KYC documents.
-- File upload itself should be performed by a protected server action/Edge Function.
drop policy if exists "Internal users can read customer documents" on public.customer_documents;
create policy "Internal users can read customer documents"
on public.customer_documents
for select
to authenticated
using (
  public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user',
    'sales_operations_head',
    'backoffice_executive'
  )
);

drop policy if exists "Internal users can insert customer documents" on public.customer_documents;
create policy "Internal users can insert customer documents"
on public.customer_documents
for insert
to authenticated
with check (
  public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user',
    'sales_operations_head',
    'backoffice_executive'
  )
);

drop policy if exists "Internal users can update customer documents" on public.customer_documents;
create policy "Internal users can update customer documents"
on public.customer_documents
for update
to authenticated
using (
  public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user',
    'sales_operations_head',
    'backoffice_executive'
  )
)
with check (
  public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user',
    'sales_operations_head',
    'backoffice_executive'
  )
);

comment on column public.customers.aadhaar_hash is
  'One-way server-generated hash for duplicate detection. Never store raw Aadhaar in this table.';
comment on column public.customers.aadhaar_last_four is
  'Last four Aadhaar digits for masked display only.';
comment on column public.customers.india_location_id is
  'Selected india_locations row; city/state/postal_code remain the historical address snapshot.';
