create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text unique not null,
  customer_id uuid not null references public.customers(id) on delete cascade,
  claim_id uuid references public.claims(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('claim', 'policy', 'documents', 'roadside', 'other')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  subject text not null check (char_length(subject) between 3 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.assign_support_ticket_number()
returns trigger
language plpgsql
as $$
begin
  if new.ticket_no is null or new.ticket_no = '' then
    new.ticket_no := 'TKT-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('support_ticket_number_seq')::text, 5, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create sequence if not exists public.support_ticket_number_seq;

drop trigger if exists support_tickets_assign_number on public.support_tickets;
create trigger support_tickets_assign_number
before insert or update on public.support_tickets
for each row execute function public.assign_support_ticket_number();

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.support_ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  file_name text not null,
  storage_bucket text not null default 'support-ticket-files',
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_customer_created_idx on public.support_tickets(customer_id, created_at desc);
create index if not exists support_tickets_assigned_created_idx on public.support_tickets(assigned_to, created_at desc);
create index if not exists support_ticket_messages_ticket_created_idx on public.support_ticket_messages(ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_attachments enable row level security;

create policy "support tickets customer select own"
on public.support_tickets for select to authenticated
using (customer_id in (select id from public.customers where profile_id = auth.uid()) or assigned_to = auth.uid());

create policy "support tickets customer create own"
on public.support_tickets for insert to authenticated
with check (
  created_by = auth.uid()
  and customer_id in (select id from public.customers where profile_id = auth.uid())
  and (claim_id is null or claim_id in (select id from public.claims where customer_id in (select id from public.customers where profile_id = auth.uid())))
  and (assigned_to is null or assigned_to = (select assigned_to from public.claims where id = claim_id))
);

create policy "support tickets assignee update"
on public.support_tickets for update to authenticated
using (assigned_to = auth.uid())
with check (assigned_to = auth.uid());

create policy "support messages ticket members select"
on public.support_ticket_messages for select to authenticated
using (ticket_id in (select id from public.support_tickets));

create policy "support messages ticket members create"
on public.support_ticket_messages for insert to authenticated
with check (sender_id = auth.uid() and ticket_id in (select id from public.support_tickets));

create policy "support attachments ticket members select"
on public.support_ticket_attachments for select to authenticated
using (ticket_id in (select id from public.support_tickets));

create policy "support attachments ticket members create"
on public.support_ticket_attachments for insert to authenticated
with check (uploaded_by = auth.uid() and ticket_id in (select id from public.support_tickets));

insert into storage.buckets (id, name, public)
values ('support-ticket-files', 'support-ticket-files', false)
on conflict (id) do nothing;

create policy "support ticket objects upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-ticket-files'
  and split_part(name, '/', 1) in (select id::text from public.customers where profile_id = auth.uid())
);

create policy "support ticket objects view"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-ticket-files'
  and split_part(name, '/', 1) in (select id::text from public.customers where profile_id = auth.uid())
);
