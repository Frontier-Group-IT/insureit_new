-- Fulfillment gates / audit only; no Auth user or business record deletion.
alter table public.partner_account_deletion_requests
  add column if not exists fulfillment_authorized_by uuid,
  add column if not exists fulfillment_authorized_at timestamptz,
  add column if not exists identity_verified_at timestamptz,
  add column if not exists retention_reviewed_at timestamptz,
  add column if not exists notification_sent_at timestamptz,
  add column if not exists fulfillment_reference text;

create table if not exists public.partner_account_deletion_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.partner_account_deletion_requests(id) on delete restrict,
  actor_profile_id uuid,
  action text not null check (action in ('review_started','declined','fulfillment_authorized','fulfillment_blocked','identity_revoked','notification_recorded','fulfilled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists partner_account_deletion_events_request_idx
  on public.partner_account_deletion_events(request_id,created_at desc);
alter table public.partner_account_deletion_events enable row level security;
revoke all on public.partner_account_deletion_events from public,anon,authenticated;
grant select,insert on public.partner_account_deletion_events to service_role;
comment on table public.partner_account_deletion_events is 'Append-only operational audit for privacy account deletion requests; service-role writes only.';

-- Explicitly prevent fulfillment state unless all independently recorded steps exist.
create or replace function public.partner_deletion_fulfillment_gate()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status = 'fulfilled' and old.status is distinct from 'fulfilled' then
    if new.identity_verified_at is null or new.retention_reviewed_at is null
      or new.fulfillment_authorized_by is null or new.fulfillment_authorized_at is null
      or new.notification_sent_at is null or new.fulfillment_reference is null
      or length(btrim(new.fulfillment_reference)) < 8 then
      raise exception 'Deletion fulfillment requires recorded identity, retention, approval, notification and external fulfillment reference';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists partner_deletion_fulfillment_gate_trigger on public.partner_account_deletion_requests;
create trigger partner_deletion_fulfillment_gate_trigger
before update on public.partner_account_deletion_requests
for each row execute function public.partner_deletion_fulfillment_gate();
revoke all on function public.partner_deletion_fulfillment_gate() from public,anon,authenticated;
