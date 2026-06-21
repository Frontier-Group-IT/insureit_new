-- Manager-side claim workflow expansion.
alter type public.claim_status add value if not exists 'Claim Intimation';
alter type public.claim_status add value if not exists 'Final Surveyor Details';
alter type public.claim_status add value if not exists 'Survey Status';
alter type public.claim_status add value if not exists 'Survey Done';
alter type public.claim_status add value if not exists 'Work Approval Status';
alter type public.claim_status add value if not exists 'Work Approval Received';
alter type public.claim_status add value if not exists 'Under Repair';
alter type public.claim_status add value if not exists 'RA Intimation';
alter type public.claim_status add value if not exists 'RA Intimation Done';
alter type public.claim_status add value if not exists 'DO Status';
alter type public.claim_status add value if not exists 'Payment Stage';
alter type public.claim_status add value if not exists 'Claim Complete';

create table if not exists public.claim_stage_details (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  stage public.claim_status not null,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists claim_stage_details_claim_id_idx on public.claim_stage_details(claim_id);
create index if not exists claim_stage_details_stage_idx on public.claim_stage_details(stage);

alter table public.claim_stage_details enable row level security;

drop policy if exists "claim stage details hierarchy read" on public.claim_stage_details;
create policy "claim stage details hierarchy read"
on public.claim_stage_details for select
to authenticated
using (public.can_access_claim(auth.uid(), claim_id));

drop policy if exists "claim stage details hierarchy insert" on public.claim_stage_details;
create policy "claim stage details hierarchy insert"
on public.claim_stage_details for insert
to authenticated
with check (public.can_access_claim(auth.uid(), claim_id));

drop policy if exists "claim stage details hierarchy update" on public.claim_stage_details;
create policy "claim stage details hierarchy update"
on public.claim_stage_details for update
to authenticated
using (public.can_access_claim(auth.uid(), claim_id))
with check (public.can_access_claim(auth.uid(), claim_id));

drop trigger if exists claim_stage_details_updated_at on public.claim_stage_details;
create trigger claim_stage_details_updated_at
before update on public.claim_stage_details
for each row execute function public.set_updated_at();
