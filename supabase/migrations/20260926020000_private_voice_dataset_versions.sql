-- INSUREIT Private Voice Agent — Phase 2 reviewed/frozen dataset releases
-- Isolated from Sarvam production campaign and attempt tables.

alter table public.private_voice_training_examples
  add column if not exists reviewed_by uuid,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.private_voice_dataset_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  status text not null default 'building' check (status in ('building','frozen','failed','retired')),
  notes text,
  manifest jsonb not null default '{}'::jsonb,
  training_count integer not null default 0 check (training_count >= 0),
  validation_count integer not null default 0 check (validation_count >= 0),
  test_count integer not null default 0 check (test_count >= 0),
  created_by uuid,
  frozen_by uuid,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.private_voice_dataset_members (
  id uuid primary key default gen_random_uuid(),
  dataset_version_id uuid not null references public.private_voice_dataset_versions(id) on delete restrict,
  training_example_id uuid not null references public.private_voice_training_examples(id) on delete restrict,
  split text not null check (split in ('training','validation','test')),
  example_snapshot jsonb not null,
  example_hash text not null,
  created_at timestamptz not null default now(),
  unique (dataset_version_id, training_example_id)
);

create index if not exists private_voice_dataset_members_version_idx
  on public.private_voice_dataset_members(dataset_version_id, split);
create index if not exists private_voice_dataset_members_example_idx
  on public.private_voice_dataset_members(training_example_id);

alter table public.private_voice_dataset_versions enable row level security;
alter table public.private_voice_dataset_members enable row level security;

-- Service-role-only by default. No direct browser mutation policies are added.

create or replace function public.prevent_private_voice_dataset_member_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Frozen private voice dataset members are immutable';
end;
$$;

drop trigger if exists private_voice_dataset_members_immutable_update on public.private_voice_dataset_members;
create trigger private_voice_dataset_members_immutable_update
before update or delete on public.private_voice_dataset_members
for each row execute function public.prevent_private_voice_dataset_member_mutation();

comment on table public.private_voice_dataset_versions is 'Versioned private voice training/evaluation dataset releases; only status=frozen is a valid reproducible release.';
comment on table public.private_voice_dataset_members is 'Immutable snapshots of approved private voice examples; permanent-test rows remain test-only.';
