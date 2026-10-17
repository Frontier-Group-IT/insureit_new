begin;

create table if not exists public.partner_activity_read_receipts (
  auth_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_key text not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (auth_user_id, event_key),
  constraint partner_activity_read_receipts_event_key_check
    check (length(event_key) between 1 and 320)
);

create index if not exists partner_activity_read_receipts_read_at_idx
  on public.partner_activity_read_receipts (auth_user_id, read_at desc);

alter table public.partner_activity_read_receipts enable row level security;

drop policy if exists partner_activity_read_receipts_select_own on public.partner_activity_read_receipts;
create policy partner_activity_read_receipts_select_own
  on public.partner_activity_read_receipts
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists partner_activity_read_receipts_insert_own on public.partner_activity_read_receipts;
create policy partner_activity_read_receipts_insert_own
  on public.partner_activity_read_receipts
  for insert
  to authenticated
  with check (auth.uid() = auth_user_id);

drop policy if exists partner_activity_read_receipts_update_own on public.partner_activity_read_receipts;
create policy partner_activity_read_receipts_update_own
  on public.partner_activity_read_receipts
  for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

drop policy if exists partner_activity_read_receipts_delete_own on public.partner_activity_read_receipts;
create policy partner_activity_read_receipts_delete_own
  on public.partner_activity_read_receipts
  for delete
  to authenticated
  using (auth.uid() = auth_user_id);

revoke all on table public.partner_activity_read_receipts from public, anon;
grant select, insert, update, delete on table public.partner_activity_read_receipts to authenticated;
grant all on table public.partner_activity_read_receipts to service_role;

commit;
