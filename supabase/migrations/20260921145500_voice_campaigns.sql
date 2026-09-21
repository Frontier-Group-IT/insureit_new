begin;

create table if not exists public.voice_campaigns (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  source_batch_id uuid references public.external_renewal_import_batches(id) on delete restrict,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','enriching','ready','needs_review','running','paused','completed','cancelled')),
  total_rows integer not null default 0 check (total_rows between 0 and 100),
  accepted_rows integer not null default 0 check (accepted_rows between 0 and 100),
  rejected_rows integer not null default 0 check (rejected_rows between 0 and 100),
  duplicate_rows integer not null default 0 check (duplicate_rows between 0 and 100),
  enriched_rows integer not null default 0 check (enriched_rows between 0 and 100),
  created_by_auth_user_id uuid not null,
  started_at timestamptz,
  dispatch_completed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.voice_campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.voice_campaigns(id) on delete cascade,
  opportunity_id uuid not null references public.external_renewal_opportunities(id) on delete restrict,
  source_row_number integer not null check (source_row_number > 1),
  import_status text not null default 'accepted' check (import_status in ('accepted','held')),
  hold_reason text,
  enrichment_status text not null default 'pending' check (enrichment_status in ('pending','ready','failed','held')),
  enrichment_error text,
  dispatch_status text not null default 'pending' check (dispatch_status in ('pending','queued','failed','held','skipped')),
  dispatch_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, opportunity_id)
);

alter table public.external_renewal_opportunities
  drop constraint if exists external_renewal_opportunities_voice_queue_source_check;

alter table public.external_renewal_opportunities
  add constraint external_renewal_opportunities_voice_queue_source_check
  check (voice_queue_source in ('import','it_quick_add','it_campaign'));

alter table public.external_renewal_voice_attempts
  add column if not exists voice_campaign_id uuid references public.voice_campaigns(id) on delete set null;

create index if not exists voice_campaigns_created_idx
  on public.voice_campaigns (created_at desc);

create index if not exists voice_campaign_members_campaign_idx
  on public.voice_campaign_members (campaign_id, enrichment_status, dispatch_status);

create index if not exists external_renewal_voice_attempts_campaign_idx
  on public.external_renewal_voice_attempts (voice_campaign_id, created_at desc)
  where voice_campaign_id is not null;

alter table public.voice_campaigns enable row level security;
alter table public.voice_campaign_members enable row level security;

revoke all on public.voice_campaigns from public, anon, authenticated;
revoke all on public.voice_campaign_members from public, anon, authenticated;
grant all on public.voice_campaigns to service_role;
grant all on public.voice_campaign_members to service_role;

comment on table public.voice_campaigns is
  'IT-controlled AI renewal campaigns. Maximum 100 uploaded prospects per campaign.';

comment on table public.voice_campaign_members is
  'Campaign membership and enrichment/dispatch state for isolated External Renewal opportunities.';

commit;
