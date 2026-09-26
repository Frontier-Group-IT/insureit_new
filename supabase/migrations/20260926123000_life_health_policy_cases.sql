create table if not exists public.life_health_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  business_line text not null check (business_line in ('Life', 'Health')),
  status text not null default 'awaiting_policy' check (status in ('draft', 'awaiting_policy', 'issued', 'cancelled', 'rejected')),
  sourcing_date date not null,
  customer_id uuid not null references public.customers(id),
  insurance_company_id uuid not null references public.insurance_companies(id),
  product_name text not null,
  proposal_number text not null,
  premium_paying_term text,
  policy_duration text,
  payment_frequency text not null,
  payment_mode text not null,
  premium_amount numeric not null default 0 check (premium_amount >= 0),
  intermediary_id uuid references public.intermediaries(id),
  intermediary_type text,
  intermediary_code text,
  lead_source text,
  intermediary_mobile text,
  rm_employee_id uuid references public.employees(id),
  rm_name text,
  rm_code text,
  remarks text,
  details jsonb not null default '{}'::jsonb,
  final_policy_id uuid unique references public.policies(id),
  converted_at timestamptz,
  converted_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists life_health_cases_status_idx on public.life_health_cases(status, created_at desc);
create index if not exists life_health_cases_customer_idx on public.life_health_cases(customer_id, created_at desc);
create index if not exists life_health_cases_source_idx on public.life_health_cases(intermediary_id, sourcing_date desc);
create index if not exists life_health_cases_proposal_idx on public.life_health_cases(proposal_number);

create table if not exists public.life_health_case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.life_health_cases(id) on delete cascade,
  document_type text not null check (document_type in ('proposal_form', 'benefit_illustration', 'premium_receipt', 'policy_copy')),
  file_name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(case_id, document_type)
);

create index if not exists life_health_case_documents_case_idx on public.life_health_case_documents(case_id, document_type);

create table if not exists public.life_health_policy_details (
  policy_id uuid primary key references public.policies(id) on delete cascade,
  source_case_id uuid unique references public.life_health_cases(id),
  proposal_number text,
  premium_paying_term text,
  policy_duration text,
  payment_frequency text,
  payment_mode text,
  additional_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.life_health_cases enable row level security;
alter table public.life_health_case_documents enable row level security;
alter table public.life_health_policy_details enable row level security;

comment on table public.life_health_cases is 'Pre-issuance Life and Health proposal/case workflow. A case converts to policies only when an actual policy number is available.';
comment on column public.life_health_cases.sourcing_date is 'Date the case was sourced. The universal Add Policy Section 01 date is used as sourcing date for Life/Health cases.';
comment on column public.life_health_cases.premium_paying_term is 'PPT - Premium Paying Term.';
comment on column public.life_health_cases.policy_duration is 'PD - Policy Duration / Policy Term.';
