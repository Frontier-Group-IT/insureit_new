-- Customer service enquiries for guest and signed-in Quote / Challan assistance.
-- Guest writes are accepted only through the guest-service-enquiry Edge Function (service role).
-- Signed-in customers may create/read their own enquiries. Internal operations roles may read/update them.

create sequence if not exists public.service_enquiry_number_seq;

create table if not exists public.service_enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_no text not null unique,
  service_type text not null check (service_type in ('insurance_quote', 'challan_assistance')),
  source text not null check (source in ('guest_login', 'guest_signup', 'customer_dashboard')),
  customer_id uuid references public.customers(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  guest_name text,
  guest_phone text,
  guest_email text,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  vehicle_no text,
  subject text not null check (char_length(subject) between 3 and 160),
  description text not null check (char_length(description) between 3 and 3000),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_enquiries_identity_check check (
    customer_id is not null
    or (
      nullif(btrim(guest_name), '') is not null
      and nullif(btrim(guest_phone), '') is not null
    )
  )
);

create table if not exists public.guest_service_enquiry_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  otp_hash text not null,
  attempts integer not null default 0,
  verified_at timestamptz,
  verification_token_hash text,
  verification_token_expires_at timestamptz,
  used_at timestamptz,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists service_enquiries_status_created_idx
  on public.service_enquiries(status, created_at desc);
create index if not exists service_enquiries_customer_created_idx
  on public.service_enquiries(customer_id, created_at desc);
create index if not exists service_enquiries_service_created_idx
  on public.service_enquiries(service_type, created_at desc);
create index if not exists service_enquiries_guest_phone_idx
  on public.service_enquiries(guest_phone, created_at desc)
  where guest_phone is not null;
create index if not exists guest_service_enquiry_otp_phone_idx
  on public.guest_service_enquiry_otp_challenges(phone, created_at desc);

create or replace function public.assign_service_enquiry_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.enquiry_no is null or btrim(new.enquiry_no) = '' then
    new.enquiry_no := 'ENQ-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.service_enquiry_number_seq')::text, 5, '0');
  end if;
  new.updated_at := now();
  if new.status in ('resolved', 'closed') and new.resolved_at is null then
    new.resolved_at := now();
  elsif new.status not in ('resolved', 'closed') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists service_enquiries_assign_number on public.service_enquiries;
create trigger service_enquiries_assign_number
before insert or update on public.service_enquiries
for each row execute function public.assign_service_enquiry_number();

alter table public.service_enquiries enable row level security;
alter table public.guest_service_enquiry_otp_challenges enable row level security;

revoke all on public.service_enquiries from anon, authenticated;
grant select, insert on public.service_enquiries to authenticated;
grant update on public.service_enquiries to authenticated;
grant all on public.service_enquiries to service_role;

revoke all on public.guest_service_enquiry_otp_challenges from anon, authenticated;
grant all on public.guest_service_enquiry_otp_challenges to service_role;

create policy "service enquiries customer select own"
on public.service_enquiries
for select to authenticated
using (
  customer_id in (
    select c.id from public.customers c where c.profile_id = auth.uid()
  )
  or public.current_app_role() in (
    'super_admin','admin','manager','claim_processor','field_executive',
    'director','sales_head','zonal_head','asm','sales_manager',
    'it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'
  )
);

create policy "service enquiries customer create own"
on public.service_enquiries
for insert to authenticated
with check (
  created_by = auth.uid()
  and customer_id in (
    select c.id from public.customers c where c.profile_id = auth.uid()
  )
  and source = 'customer_dashboard'
  and guest_name is null
  and guest_phone is null
  and guest_email is null
  and (
    vehicle_id is null
    or vehicle_id in (
      select v.id
      from public.vehicles v
      where v.customer_id = customer_id
    )
  )
);

create policy "service enquiries operations update"
on public.service_enquiries
for update to authenticated
using (
  public.current_app_role() in (
    'super_admin','admin','manager','claim_processor','field_executive',
    'director','sales_head','zonal_head','asm','sales_manager',
    'it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'
  )
)
with check (
  public.current_app_role() in (
    'super_admin','admin','manager','claim_processor','field_executive',
    'director','sales_head','zonal_head','asm','sales_manager',
    'it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'
  )
);
