-- Unify Customer App support-ticket submissions with the Operations Service Enquiries workspace.
-- New support tickets are stored in service_enquiries with service_type='support_ticket'.
-- Legacy support_tickets remain untouched for historical compatibility.

alter table public.service_enquiries
  drop constraint if exists service_enquiries_service_type_check;

alter table public.service_enquiries
  add constraint service_enquiries_service_type_check
  check (service_type in ('insurance_quote', 'challan_assistance', 'support_ticket'));

alter table public.service_enquiries
  add column if not exists claim_id uuid references public.claims(id) on delete set null,
  add column if not exists category text,
  add column if not exists priority text;

alter table public.service_enquiries
  drop constraint if exists service_enquiries_support_category_check,
  drop constraint if exists service_enquiries_support_priority_check,
  drop constraint if exists service_enquiries_support_metadata_check;

alter table public.service_enquiries
  add constraint service_enquiries_support_category_check
  check (category is null or category in ('claim', 'policy', 'documents', 'roadside', 'other')),
  add constraint service_enquiries_support_priority_check
  check (priority is null or priority in ('low', 'medium', 'high')),
  add constraint service_enquiries_support_metadata_check
  check (
    service_type <> 'support_ticket'
    or (
      category in ('claim', 'policy', 'documents', 'roadside', 'other')
      and priority in ('low', 'medium', 'high')
    )
  );

create index if not exists service_enquiries_claim_created_idx
  on public.service_enquiries(claim_id, created_at desc)
  where claim_id is not null;

drop policy if exists "service enquiries customer create own"
  on public.service_enquiries;

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
  and (
    claim_id is null
    or claim_id in (
      select cl.id
      from public.claims cl
      where cl.customer_id = customer_id
    )
  )
);

create table if not exists public.service_enquiry_messages (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.service_enquiries(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.service_enquiry_attachments (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.service_enquiries(id) on delete cascade,
  file_name text not null,
  storage_bucket text not null default 'support-ticket-files',
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists service_enquiry_messages_enquiry_created_idx
  on public.service_enquiry_messages(enquiry_id, created_at);
create index if not exists service_enquiry_attachments_enquiry_created_idx
  on public.service_enquiry_attachments(enquiry_id, created_at);

alter table public.service_enquiry_messages enable row level security;
alter table public.service_enquiry_attachments enable row level security;

revoke all on public.service_enquiry_messages from anon, authenticated;
revoke all on public.service_enquiry_attachments from anon, authenticated;
grant select, insert on public.service_enquiry_messages to authenticated;
grant select, insert on public.service_enquiry_attachments to authenticated;
grant all on public.service_enquiry_messages to service_role;
grant all on public.service_enquiry_attachments to service_role;

drop policy if exists "service enquiry messages members select" on public.service_enquiry_messages;
create policy "service enquiry messages members select"
on public.service_enquiry_messages
for select to authenticated
using (
  enquiry_id in (
    select se.id
    from public.service_enquiries se
    where se.customer_id in (
      select c.id from public.customers c where c.profile_id = auth.uid()
    )
    or public.current_app_role() in (
      'super_admin','admin','manager','claim_processor','field_executive',
      'director','sales_head','zonal_head','asm','sales_manager',
      'it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'
    )
  )
);

drop policy if exists "service enquiry messages members create" on public.service_enquiry_messages;
create policy "service enquiry messages members create"
on public.service_enquiry_messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and enquiry_id in (
    select se.id
    from public.service_enquiries se
    where se.customer_id in (
      select c.id from public.customers c where c.profile_id = auth.uid()
    )
    or public.current_app_role() in (
      'super_admin','admin','manager','claim_processor','field_executive',
      'director','sales_head','zonal_head','asm','sales_manager',
      'it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'
    )
  )
);

drop policy if exists "service enquiry attachments members select" on public.service_enquiry_attachments;
create policy "service enquiry attachments members select"
on public.service_enquiry_attachments
for select to authenticated
using (
  enquiry_id in (
    select se.id
    from public.service_enquiries se
    where se.customer_id in (
      select c.id from public.customers c where c.profile_id = auth.uid()
    )
    or public.current_app_role() in (
      'super_admin','admin','manager','claim_processor','field_executive',
      'director','sales_head','zonal_head','asm','sales_manager',
      'it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'
    )
  )
);

drop policy if exists "service enquiry attachments members create" on public.service_enquiry_attachments;
create policy "service enquiry attachments members create"
on public.service_enquiry_attachments
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and enquiry_id in (
    select se.id
    from public.service_enquiries se
    where se.customer_id in (
      select c.id from public.customers c where c.profile_id = auth.uid()
    )
  )
);
