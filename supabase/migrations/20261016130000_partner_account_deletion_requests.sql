-- Request-only workflow. This migration never removes Auth users or business records.
create table if not exists public.partner_account_deletion_requests (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null,
 actor_kind text not null check (actor_kind in ('employee','intermediary')),
 actor_id uuid not null,
 intermediary_id uuid,
 status text not null default 'requested' check (status in ('requested','under_review','fulfilling','fulfilled','declined')),
 reason text,
 requested_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 resolution_note text,
 reviewed_by uuid,
 reviewed_at timestamptz
);
create unique index if not exists partner_account_deletion_open_unique
 on public.partner_account_deletion_requests(auth_user_id)
 where status in ('requested','under_review','fulfilling');
create index if not exists partner_account_deletion_requested_idx
 on public.partner_account_deletion_requests(requested_at desc);
alter table public.partner_account_deletion_requests enable row level security;
revoke all on public.partner_account_deletion_requests from public, anon, authenticated;
grant select, insert, update on public.partner_account_deletion_requests to service_role;
comment on table public.partner_account_deletion_requests is
 'Authenticated Partner user privacy deletion requests. Fulfillment requires separately authorized manual verification and legal retention review. No automatic business deletion.';
