create table if not exists public.policy_intake_requests (
  id uuid primary key default gen_random_uuid(),
  intake_number text not null unique,
  status text not null default 'processing' check (status in ('processing','ready_for_review','in_review','needs_attention','completed','rejected')),
  submitted_by_profile_id uuid not null references public.profiles(id),
  lead_source_id uuid not null references public.intermediaries(id),
  lead_source_type text not null check (lead_source_type in ('posp','misp','partner')),
  lead_source_name text not null,
  lead_source_code text,
  customer_mobile text not null,
  matched_customer_id uuid references public.customers(id),
  storage_bucket text not null default 'policy-documents',
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size bigint,
  ocr_status text not null default 'pending' check (ocr_status in ('pending','processing','completed','failed')),
  ocr_fields jsonb not null default '[]'::jsonb,
  ocr_parser_id text,
  ocr_parser_version text,
  ocr_warnings jsonb not null default '[]'::jsonb,
  assigned_to_profile_id uuid references public.profiles(id),
  attention_reason text,
  final_policy_id uuid references public.policies(id),
  finalized_by_profile_id uuid references public.profiles(id),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_policy_intakes_status_created on public.policy_intake_requests(status, created_at);
create index if not exists idx_policy_intakes_submitter on public.policy_intake_requests(submitted_by_profile_id, created_at desc);
create index if not exists idx_policy_intakes_lead_source on public.policy_intake_requests(lead_source_id);

alter table public.policy_intake_requests enable row level security;
revoke all on public.policy_intake_requests from anon, authenticated;
grant all on public.policy_intake_requests to service_role;

create or replace function public.touch_policy_intake_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_policy_intake_updated_at on public.policy_intake_requests;
create trigger trg_policy_intake_updated_at
before update on public.policy_intake_requests
for each row execute function public.touch_policy_intake_updated_at();
