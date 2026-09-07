begin;

create table if not exists public.policy_ocr_training_orchestrators (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'planned'
    check (status in ('planned','running','paused','awaiting_it_approval','awaiting_satisfaction','completed','stopped')),
  iteration_no integer not null default 1 check (iteration_no > 0),
  insurer_limit integer not null default 10 check (insurer_limit between 1 and 10),
  sample_budget integer not null default 25 check (sample_budget between 1 and 100),
  processed_count integer not null default 0 check (processed_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  wrong_financial_count integer not null default 0 check (wrong_financial_count >= 0),
  field_accuracy numeric(6,5),
  min_field_accuracy numeric(6,5) not null default 0.95,
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  min_fresh_siblings integer not null default 3 check (min_fresh_siblings between 3 and 20),
  operator_override text,
  lease_token uuid,
  lease_expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_ocr_training_samples (
  id uuid primary key default gen_random_uuid(),
  orchestrator_id uuid not null references public.policy_ocr_training_orchestrators(id) on delete cascade,
  training_label_id uuid not null references public.policy_ocr_training_labels(id) on delete cascade,
  insurer_name text,
  product_family text,
  layout_family text,
  sample_kind text not null default 'train'
    check (sample_kind in ('train','holdout','fresh_sibling')),
  status text not null default 'queued'
    check (status in ('queued','processing','ready','review_required','accepted','rejected','withheld','exhausted')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  lease_token uuid,
  lease_expires_at timestamptz,
  comparison jsonb,
  feedback_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (orchestrator_id, training_label_id)
);

create index if not exists policy_ocr_training_samples_priority_idx
  on public.policy_ocr_training_samples(orchestrator_id, status, insurer_name, product_family, layout_family);

alter table public.policy_ocr_training_orchestrators enable row level security;
alter table public.policy_ocr_training_samples enable row level security;
revoke all on table public.policy_ocr_training_orchestrators, public.policy_ocr_training_samples from public, anon, authenticated;
grant all on table public.policy_ocr_training_orchestrators, public.policy_ocr_training_samples to service_role;

alter table public.policy_ocr_training_review_tasks
  alter column training_label_id drop not null,
  alter column assigned_by_profile_id drop not null,
  add column if not exists task_type text not null default 'comparison'
    check (task_type in ('comparison','satisfaction')),
  add column if not exists orchestrator_id uuid references public.policy_ocr_training_orchestrators(id) on delete set null,
  add column if not exists sample_id uuid references public.policy_ocr_training_samples(id) on delete set null,
  add column if not exists field_questions jsonb not null default '[]'::jsonb,
  add column if not exists structured_feedback jsonb,
  add column if not exists satisfaction_confirmed boolean,
  add column if not exists satisfaction_note text;

create unique index if not exists policy_ocr_satisfaction_task_once_idx
  on public.policy_ocr_training_review_tasks(orchestrator_id)
  where task_type = 'satisfaction' and status <> 'cancelled';

create table if not exists public.policy_ocr_training_feedback (
  id uuid primary key default gen_random_uuid(),
  review_task_id uuid not null unique references public.policy_ocr_training_review_tasks(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id) on delete restrict,
  answers jsonb not null,
  sanitized_evidence jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.policy_ocr_training_change_proposals (
  id uuid primary key default gen_random_uuid(),
  orchestrator_id uuid not null references public.policy_ocr_training_orchestrators(id) on delete cascade,
  iteration_no integer not null,
  insurer_name text,
  product_family text,
  layout_family text,
  sanitized_patch jsonb not null,
  regression_plan jsonb not null default '{}'::jsonb,
  status text not null default 'pending_it_approval'
    check (status in ('draft','pending_it_approval','approved','rejected','superseded')),
  it_approved_by uuid references public.profiles(id) on delete set null,
  it_approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.policy_ocr_training_feedback enable row level security;
alter table public.policy_ocr_training_change_proposals enable row level security;
revoke all on table public.policy_ocr_training_feedback, public.policy_ocr_training_change_proposals from public, anon, authenticated;
grant all on table public.policy_ocr_training_feedback, public.policy_ocr_training_change_proposals to service_role;

create or replace function public.claim_policy_ocr_orchestrator_samples(
  p_orchestrator_id uuid,
  p_limit integer default 25,
  p_lease_minutes integer default 4
)
returns table (
  sample_id uuid,
  orchestrator_id uuid,
  iteration_no integer,
  label_id uuid,
  policy_document_id uuid,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size bigint,
  lease_token uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with active as (
    select o.id, o.iteration_no, o.insurer_limit
    from policy_ocr_training_orchestrators o
    where o.id = p_orchestrator_id and o.status = 'running'
    for update
  ), insurer_volume as (
    select coalesce(nullif(trim(ic.name), ''), 'Unknown insurer') insurer_name,
           count(*)::integer volume
    from policy_documents d
    join policy_ocr_training_labels l on l.policy_document_id = d.id
    left join policies p on p.id = d.policy_id
    left join insurance_companies ic on ic.id = p.insurance_company_id
    where d.document_type = 'policy_copy'
      and l.processing_status in ('pending','failed')
    group by 1
    order by volume desc, insurer_name
    limit (select insurer_limit from active)
  ), ranked as (
    select d.id policy_document_id, l.id label_id,
           coalesce(nullif(trim(ic.name), ''), 'Unknown insurer') insurer_name,
           coalesce(nullif(trim(p.policy_type), ''), 'Unknown product') product_family,
           coalesce(nullif(trim(l.parser_id), ''), 'unknown_layout') layout_family,
           row_number() over (
             partition by coalesce(nullif(trim(ic.name), ''), 'Unknown insurer'),
                          coalesce(nullif(trim(p.policy_type), ''), 'Unknown product'),
                          coalesce(nullif(trim(l.parser_id), ''), 'unknown_layout')
             order by d.created_at asc, d.id
           ) family_rank
    from policy_documents d
    join policy_ocr_training_labels l on l.policy_document_id = d.id
    left join policies p on p.id = d.policy_id
    left join insurance_companies ic on ic.id = p.insurance_company_id
    join insurer_volume v on v.insurer_name = coalesce(nullif(trim(ic.name), ''), 'Unknown insurer')
    where d.document_type = 'policy_copy'
      and l.processing_status in ('pending','failed')
      and l.processing_attempts < 3
      and not exists (
        select 1 from policy_ocr_training_samples s
        where s.orchestrator_id = p_orchestrator_id and s.training_label_id = l.id
      )
    order by v.volume desc, ranked.insurer_name, ranked.product_family, ranked.layout_family, ranked.family_rank
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), inserted as (
    insert into policy_ocr_training_samples (
      orchestrator_id, training_label_id, insurer_name, product_family, layout_family, sample_kind,
      status, attempt_count, lease_token, lease_expires_at
    )
    select p_orchestrator_id, r.label_id, r.insurer_name, r.product_family, r.layout_family,
           case when right(r.label_id::text, 1) = '0' then 'holdout'
                when r.family_rank <= 3 then 'fresh_sibling' else 'train' end,
           'processing', 1, gen_random_uuid(),
           now() + make_interval(mins => greatest(2, least(coalesce(p_lease_minutes, 4), 10)))
    from ranked r
    on conflict (orchestrator_id, training_label_id) do nothing
    returning *
  )
  select i.id, i.orchestrator_id, a.iteration_no, i.training_label_id, d.id, d.file_name,
         d.storage_bucket, d.storage_path, d.mime_type, d.file_size, i.lease_token, i.attempt_count
  from inserted i
  join active a on true
  join policy_ocr_training_labels l on l.id = i.training_label_id
  join policy_documents d on d.id = l.policy_document_id
  ;
end;
$$;

revoke all on function public.claim_policy_ocr_orchestrator_samples(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_policy_ocr_orchestrator_samples(uuid, integer, integer) to service_role;

create or replace function public.refresh_policy_ocr_orchestrator_metrics(p_orchestrator_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processed integer;
  v_matched integer;
  v_comparable integer;
  v_wrong_financial integer;
  v_fresh_ready boolean;
begin
  select count(*) filter (where comparison is not null),
         coalesce(sum((select count(*) from jsonb_each_text(comparison->'fields') where value = 'match')), 0),
         coalesce(sum((select count(*) from jsonb_each_text(comparison->'fields') where value <> 'reference_missing')), 0),
         coalesce(sum((select count(*) from jsonb_each_text(comparison->'fields')
                       where key in ('idv','od_premium','tp_premium','cpa_premium','printed_net_premium','printed_gst','printed_gross_premium')
                         and value = 'mismatch')), 0)
    into v_processed, v_matched, v_comparable, v_wrong_financial
    from policy_ocr_training_samples
   where orchestrator_id = p_orchestrator_id;

  select coalesce(bool_and(accepted_count >= (select min_fresh_siblings from policy_ocr_training_orchestrators where id = p_orchestrator_id)), false)
    into v_fresh_ready
    from (
      select insurer_name, layout_family,
             count(*) filter (where status = 'accepted') accepted_count
        from policy_ocr_training_samples
       where orchestrator_id = p_orchestrator_id and sample_kind = 'fresh_sibling'
       group by insurer_name, layout_family
    ) grouped;

  update policy_ocr_training_orchestrators
     set processed_count = v_processed,
         accepted_count = v_matched,
         wrong_financial_count = v_wrong_financial,
         field_accuracy = case when v_comparable > 0 then v_matched::numeric / v_comparable else null end,
         status = case
           when v_processed >= sample_budget
            and v_comparable > 0
            and v_matched::numeric / v_comparable >= min_field_accuracy
            and v_wrong_financial = 0
            and not exists (
              select 1 from policy_ocr_training_samples h
               where h.orchestrator_id = p_orchestrator_id
                 and h.sample_kind = 'holdout'
                 and h.status in ('rejected','withheld','review_required','exhausted')
            )
            and v_fresh_ready
           then 'awaiting_satisfaction'
           else status
         end,
         updated_at = now()
   where id = p_orchestrator_id;
end;
$$;

revoke all on function public.refresh_policy_ocr_orchestrator_metrics(uuid) from public, anon, authenticated;
grant execute on function public.refresh_policy_ocr_orchestrator_metrics(uuid) to service_role;

drop trigger if exists policy_ocr_training_orchestrators_updated_at on public.policy_ocr_training_orchestrators;
create trigger policy_ocr_training_orchestrators_updated_at before update on public.policy_ocr_training_orchestrators
for each row execute function public.set_updated_at();
drop trigger if exists policy_ocr_training_samples_updated_at on public.policy_ocr_training_samples;
create trigger policy_ocr_training_samples_updated_at before update on public.policy_ocr_training_samples
for each row execute function public.set_updated_at();

comment on table public.policy_ocr_training_samples is
  'Bounded insurer-volume-prioritized training/holdout sample assignments. Raw OCR and policy bytes remain private.';
comment on table public.policy_ocr_training_change_proposals is
  'Sanitized, reviewable parser/refiner proposals. This table never executes or deploys code.';

commit;
