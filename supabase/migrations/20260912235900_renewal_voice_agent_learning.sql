-- Renewal Voice Lab interaction memory.
-- Stores transcript turns and tester quality feedback only; raw audio is intentionally not persisted.

create table if not exists public.renewal_voice_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  model text not null,
  voice text not null check (voice in ('alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar')),
  agent_type text not null check (agent_type in ('natural_sales','calm_advisor','relationship_manager','concise_professional')),
  language_mode text not null default 'auto' check (language_mode in ('auto','hinglish','hindi','english')),
  status text not null default 'active' check (status in ('active','completed','failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 14400),
  naturalness_rating smallint check (naturalness_rating is null or naturalness_rating between 1 and 5),
  pronunciation_rating smallint check (pronunciation_rating is null or pronunciation_rating between 1 and 5),
  pacing_rating smallint check (pacing_rating is null or pacing_rating between 1 and 5),
  tester_feedback text check (tester_feedback is null or char_length(tester_feedback) <= 2000),
  use_for_learning boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.renewal_voice_agent_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.renewal_voice_agent_sessions(id) on delete cascade,
  sequence_no integer not null check (sequence_no > 0 and sequence_no <= 1000),
  role text not null check (role in ('agent','customer')),
  transcript text not null check (char_length(transcript) between 1 and 8000),
  event_type text,
  created_at timestamptz not null default now(),
  unique (session_id, sequence_no)
);

create index if not exists renewal_voice_agent_sessions_learning_idx
  on public.renewal_voice_agent_sessions (use_for_learning, status, ended_at desc)
  where use_for_learning = true and status = 'completed';

create index if not exists renewal_voice_agent_sessions_creator_idx
  on public.renewal_voice_agent_sessions (created_by, created_at desc);

create index if not exists renewal_voice_agent_turns_session_idx
  on public.renewal_voice_agent_turns (session_id, sequence_no);

alter table public.renewal_voice_agent_sessions enable row level security;
alter table public.renewal_voice_agent_turns enable row level security;

create policy renewal_voice_agent_sessions_owner_select
  on public.renewal_voice_agent_sessions
  for select to authenticated
  using (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true and p.role <> 'customer'::public.app_role
    )
  );

create policy renewal_voice_agent_sessions_owner_insert
  on public.renewal_voice_agent_sessions
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_active = true and p.role <> 'customer'::public.app_role
    )
  );

create policy renewal_voice_agent_sessions_owner_update
  on public.renewal_voice_agent_sessions
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy renewal_voice_agent_turns_owner_select
  on public.renewal_voice_agent_turns
  for select to authenticated
  using (
    exists (
      select 1 from public.renewal_voice_agent_sessions s
      where s.id = session_id and s.created_by = (select auth.uid())
    )
  );

create policy renewal_voice_agent_turns_owner_insert
  on public.renewal_voice_agent_turns
  for insert to authenticated
  with check (
    exists (
      select 1 from public.renewal_voice_agent_sessions s
      where s.id = session_id and s.created_by = (select auth.uid()) and s.status = 'active'
    )
  );

grant select, insert, update on public.renewal_voice_agent_sessions to authenticated;
grant select, insert on public.renewal_voice_agent_turns to authenticated;

comment on table public.renewal_voice_agent_sessions is 'Internal browser voice-lab session metadata and tester quality feedback. No raw audio.';
comment on table public.renewal_voice_agent_turns is 'Transcript turns captured from internal renewal voice-lab sessions.';
