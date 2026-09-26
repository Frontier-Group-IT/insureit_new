-- INSUREIT Private Voice Agent — Phase 1 technical isolation
-- This schema is intentionally separate from the working Sarvam campaign/attempt tables.
-- No trigger, view, policy, function or foreign key in this migration changes Sarvam behavior.

create table if not exists public.private_voice_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','shadow','internal','pilot','paused','completed','failed','archived')),
  execution_mode text not null default 'shadow' check (execution_mode in ('shadow','internal','pilot')),
  agent_version_id uuid,
  source_campaign_id uuid,
  created_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_voice_campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.private_voice_campaigns(id) on delete cascade,
  source_opportunity_id uuid not null,
  source_row_number integer,
  status text not null default 'pending' check (status in ('pending','ready','blocked','completed','failed','skipped')),
  context_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, source_opportunity_id)
);

create table if not exists public.private_voice_agent_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  status text not null default 'draft' check (status in ('draft','evaluation','approved','retired')),
  system_prompt text,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (name, version)
);

alter table public.private_voice_campaigns
  add constraint private_voice_campaigns_agent_version_fk
  foreign key (agent_version_id) references public.private_voice_agent_versions(id) on delete set null;

create table if not exists public.private_voice_attempts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.private_voice_campaigns(id) on delete set null,
  campaign_member_id uuid references public.private_voice_campaign_members(id) on delete set null,
  source_opportunity_id uuid not null,
  execution_mode text not null default 'shadow' check (execution_mode in ('shadow','internal','pilot')),
  status text not null default 'created' check (status in ('created','queued','connecting','in_progress','completed','failed','cancelled')),
  telephony_provider text,
  stt_provider text,
  llm_provider text,
  tts_provider text,
  provider_call_id text,
  agent_version_id uuid references public.private_voice_agent_versions(id) on delete set null,
  attempt_number integer not null default 1 check (attempt_number > 0),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds numeric,
  connectivity_status text,
  completion_status text,
  call_disposition text,
  customer_interest text,
  customer_objection text,
  follow_up_required boolean,
  follow_up_at timestamptz,
  quote_requested boolean,
  human_assistance_required boolean,
  do_not_contact boolean,
  wrong_person boolean,
  already_renewed boolean,
  call_summary text,
  next_action text,
  failure_reason text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_voice_attempt_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.private_voice_attempts(id) on delete cascade,
  event_type text not null,
  event_source text not null default 'private_runtime',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.private_voice_sessions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.private_voice_attempts(id) on delete cascade,
  state text not null default 'created' check (state in ('created','connecting','listening','thinking','speaking','completed','failed')),
  language_hint text,
  context_snapshot jsonb not null default '{}'::jsonb,
  runtime_state jsonb not null default '{}'::jsonb,
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_voice_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.private_voice_sessions(id) on delete cascade,
  turn_index integer not null check (turn_index >= 0),
  role text not null check (role in ('customer','agent','system','tool')),
  text text,
  state_before text,
  state_after text,
  latency_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

create table if not exists public.private_voice_training_examples (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'historical_call',
  source_reference text,
  split text check (split in ('training','validation','test','excluded')),
  status text not null default 'draft' check (status in ('draft','reviewed','approved','excluded')),
  context jsonb not null default '{}'::jsonb,
  conversation jsonb not null default '[]'::jsonb,
  target_outcome jsonb not null default '{}'::jsonb,
  quality_labels jsonb not null default '{}'::jsonb,
  exclusion_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.private_voice_evaluations (
  id uuid primary key default gen_random_uuid(),
  agent_version_id uuid references public.private_voice_agent_versions(id) on delete set null,
  training_example_id uuid references public.private_voice_training_examples(id) on delete set null,
  attempt_id uuid references public.private_voice_attempts(id) on delete set null,
  evaluation_type text not null,
  score numeric,
  passed boolean,
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists private_voice_campaign_members_campaign_idx on public.private_voice_campaign_members(campaign_id);
create index if not exists private_voice_campaign_members_opportunity_idx on public.private_voice_campaign_members(source_opportunity_id);
create index if not exists private_voice_attempts_campaign_idx on public.private_voice_attempts(campaign_id);
create index if not exists private_voice_attempts_opportunity_idx on public.private_voice_attempts(source_opportunity_id);
create index if not exists private_voice_attempts_status_idx on public.private_voice_attempts(status);
create index if not exists private_voice_attempt_events_attempt_idx on public.private_voice_attempt_events(attempt_id, created_at);
create index if not exists private_voice_turns_session_idx on public.private_voice_turns(session_id, turn_index);
create index if not exists private_voice_training_examples_split_idx on public.private_voice_training_examples(split, status);

-- Service-role-only by default. Phase 1 deliberately exposes no direct browser policies.
alter table public.private_voice_campaigns enable row level security;
alter table public.private_voice_campaign_members enable row level security;
alter table public.private_voice_agent_versions enable row level security;
alter table public.private_voice_attempts enable row level security;
alter table public.private_voice_attempt_events enable row level security;
alter table public.private_voice_sessions enable row level security;
alter table public.private_voice_turns enable row level security;
alter table public.private_voice_training_examples enable row level security;
alter table public.private_voice_evaluations enable row level security;

comment on table public.private_voice_campaigns is 'Isolated INSUREIT private voice campaigns. Never use as an alias for the Sarvam voice_campaigns table.';
comment on table public.private_voice_attempts is 'Isolated private-agent attempts. Existing external_renewal_voice_attempts remains Sarvam production state.';
comment on table public.private_voice_sessions is 'Private conversational runtime session state. No live private calling is enabled by this schema.';
comment on table public.private_voice_training_examples is 'Curated training/evaluation records only. Raw customer transcripts must not be inserted without the approved privacy pipeline.';
