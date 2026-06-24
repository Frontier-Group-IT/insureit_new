-- Unified customer activity stream for manager dashboard
-- This table records customer-side actions from the mobile app so the claim manager
-- can see document uploads, support activity, KYC updates, and other updates in one place.

create extension if not exists pgcrypto;

create table if not exists public.customer_activity_events (
  id uuid primary key default gen_random_uuid(),

  customer_id uuid references public.customers(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  policy_id uuid references public.policies(id) on delete set null,
  support_ticket_id uuid references public.support_tickets(id) on delete cascade,

  source_table text,
  source_id uuid,

  event_type text not null,
  title text not null,
  message text,
  priority text not null default 'medium',
  status text not null default 'new',

  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_activity_events_priority_check
    check (priority in ('low', 'medium', 'high', 'critical')),

  constraint customer_activity_events_status_check
    check (status in ('new', 'seen', 'in_progress', 'handled', 'dismissed')),

  constraint customer_activity_events_event_type_check
    check (event_type in (
      'claim_submitted',
      'claim_document_uploaded',
      'claim_document_reuploaded',
      'claim_documents_completed',
      'support_ticket_created',
      'support_ticket_message_sent',
      'support_ticket_attachment_uploaded',
      'customer_kyc_uploaded',
      'customer_kyc_deleted',
      'endorsement_requested',
      'roadside_call_started',
      'notification_unread'
    ))
);

create index if not exists idx_customer_activity_events_created_at
  on public.customer_activity_events(created_at desc);

create index if not exists idx_customer_activity_events_customer_id
  on public.customer_activity_events(customer_id);

create index if not exists idx_customer_activity_events_claim_id
  on public.customer_activity_events(claim_id);

create index if not exists idx_customer_activity_events_support_ticket_id
  on public.customer_activity_events(support_ticket_id);

create index if not exists idx_customer_activity_events_status_priority
  on public.customer_activity_events(status, priority, created_at desc);

create index if not exists idx_customer_activity_events_event_type
  on public.customer_activity_events(event_type, created_at desc);

create or replace function public.set_customer_activity_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customer_activity_events_updated_at on public.customer_activity_events;
create trigger trg_customer_activity_events_updated_at
before update on public.customer_activity_events
for each row
execute function public.set_customer_activity_events_updated_at();

alter table public.customer_activity_events enable row level security;

-- Portal users who can view claim work can read customer activity.
drop policy if exists "Portal users can read customer activity events" on public.customer_activity_events;
create policy "Portal users can read customer activity events"
on public.customer_activity_events
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in (
        'manager',
        'claim_processor',
        'field_executive',
        'admin',
        'super_admin',
        'it_super_user'
      )
  )
);

-- Customers may read their own activity entries if a customer profile is linked.
drop policy if exists "Customers can read own customer activity events" on public.customer_activity_events;
create policy "Customers can read own customer activity events"
on public.customer_activity_events
for select
using (
  exists (
    select 1
    from public.customers c
    where c.id = customer_activity_events.customer_id
      and c.profile_id = auth.uid()
  )
);

-- Customers may insert their own events from the mobile app.
drop policy if exists "Customers can create own customer activity events" on public.customer_activity_events;
create policy "Customers can create own customer activity events"
on public.customer_activity_events
for insert
with check (
  exists (
    select 1
    from public.customers c
    where c.id = customer_activity_events.customer_id
      and c.profile_id = auth.uid()
  )
);

-- Portal claim users can create manager-visible events when needed.
drop policy if exists "Portal claim users can create customer activity events" on public.customer_activity_events;
create policy "Portal claim users can create customer activity events"
on public.customer_activity_events
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('manager', 'claim_processor', 'admin', 'super_admin', 'it_super_user')
  )
);

-- Portal claim users can update event handling status.
drop policy if exists "Portal claim users can update customer activity events" on public.customer_activity_events;
create policy "Portal claim users can update customer activity events"
on public.customer_activity_events
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('manager', 'claim_processor', 'admin', 'super_admin', 'it_super_user')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('manager', 'claim_processor', 'admin', 'super_admin', 'it_super_user')
  )
);

comment on table public.customer_activity_events is 'Unified activity stream of customer-side actions for the manager dashboard.';
comment on column public.customer_activity_events.event_type is 'Customer activity type such as claim_document_uploaded, support_ticket_created, or customer_kyc_uploaded.';
comment on column public.customer_activity_events.status is 'Manager handling state: new, seen, in_progress, handled, dismissed.';
comment on column public.customer_activity_events.metadata is 'Extra event-specific payload such as document type, file name, ticket priority, or mobile action context.';
