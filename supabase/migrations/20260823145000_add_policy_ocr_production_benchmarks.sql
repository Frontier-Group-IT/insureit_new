-- Production-driven, privacy-safe Policy OCR benchmark cohorts.
-- This migration does not modify operational policy/customer/vehicle records.

create table if not exists public.policy_ocr_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'selected' check (status in ('selected', 'processing', 'baseline_ready', 'completed', 'blocked')),
  selection_strategy text not null default 'top_5_insurers_production_family_v1',
  sample_per_family integer not null default 4 check (sample_per_family between 1 and 6),
  created_by uuid null references public.profiles(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.policy_ocr_benchmark_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.policy_ocr_benchmark_runs(id) on delete cascade,
  training_label_id uuid not null references public.policy_ocr_training_labels(id) on delete cascade,
  policy_document_id uuid not null references public.policy_documents(id) on delete cascade,
  public_key text not null,
  insurer_name text not null,
  policy_product text not null,
  vehicle_segment text not null,
  cohort_role text not null check (cohort_role in ('training', 'fresh_sibling', 'blind_holdout')),
  production_count integer not null default 0,
  policies_with_pdf integer not null default 0,
  approved_layout_samples integer not null default 0,
  priority_score numeric not null default 0,
  baseline_status text not null default 'pending' check (baseline_status in ('pending', 'processing', 'ready', 'failed')),
  baseline_proposal jsonb null,
  baseline_parser_id text null,
  baseline_parser_version text null,
  baseline_extraction_method text null,
  baseline_failure_code text null,
  baseline_captured_at timestamptz null,
  post_training_proposal jsonb null,
  post_training_parser_id text null,
  post_training_parser_version text null,
  post_training_captured_at timestamptz null,
  result_classification jsonb not null default '{}'::jsonb,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, policy_document_id),
  unique (run_id, public_key)
);

create index if not exists policy_ocr_benchmark_items_run_status_idx
  on public.policy_ocr_benchmark_items (run_id, baseline_status, priority_score desc);
create index if not exists policy_ocr_benchmark_items_document_idx
  on public.policy_ocr_benchmark_items (policy_document_id);

alter table public.policy_ocr_benchmark_runs enable row level security;
alter table public.policy_ocr_benchmark_items enable row level security;

revoke all on public.policy_ocr_benchmark_runs from anon, authenticated;
revoke all on public.policy_ocr_benchmark_items from anon, authenticated;
grant all on public.policy_ocr_benchmark_runs to service_role;
grant all on public.policy_ocr_benchmark_items to service_role;

create or replace function public.create_policy_ocr_production_benchmark_run(
  p_actor_id uuid,
  p_per_family integer default 4
)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_per_family integer := greatest(1, least(coalesce(p_per_family, 4), 6));
  v_item_count integer := 0;
  v_data_gap jsonb := '[]'::jsonb;
begin
  insert into public.policy_ocr_benchmark_runs (
    id, name, status, selection_strategy, sample_per_family, created_by
  ) values (
    v_run_id,
    'Production OCR benchmark ' || to_char(now(), 'YYYY-MM-DD HH24:MI'),
    'selected',
    'top_5_insurers_production_family_v1',
    v_per_family,
    p_actor_id
  );

  -- Ensure every stored policy copy has a queue label. This touches training metadata only.
  insert into public.policy_ocr_training_labels (
    policy_document_id, processing_status, processing_attempts, next_attempt_at, status
  )
  select d.id, 'pending', 0, now(), 'needs_review'
  from public.policy_documents d
  where d.document_type = 'policy_copy'
    and d.mime_type = 'application/pdf'
  on conflict (policy_document_id) do nothing;

  with production_families as (
    select
      i.name as insurer_name,
      coalesce(p.policy_type, 'Unknown') as policy_product,
      coalesce(v.vehicle_type, v.vehicle_category, v.vehicle_class_code, 'Unknown') as vehicle_segment,
      count(*)::integer as production_count,
      count(*) filter (where exists (
        select 1 from public.policy_documents d
        where d.policy_id = p.id
          and d.document_type = 'policy_copy'
          and d.mime_type = 'application/pdf'
      ))::integer as policies_with_pdf
    from public.policies p
    join public.insurance_companies i on i.id = p.insurance_company_id
    left join public.vehicles v on v.id = p.vehicle_id
    where coalesce(p.business_line, 'Motor') = 'Motor'
    group by i.name, coalesce(p.policy_type, 'Unknown'), coalesce(v.vehicle_type, v.vehicle_category, v.vehicle_class_code, 'Unknown')
  ),
  insurer_totals as (
    select insurer_name, sum(production_count)::integer as insurer_count
    from production_families
    group by insurer_name
  ),
  top_insurers as (
    select insurer_name, insurer_count
    from insurer_totals
    order by insurer_count desc, insurer_name
    limit 5
  ),
  approved_counts as (
    select
      tl.insurer_name,
      tl.policy_product,
      coalesce(tl.section_02_reference ->> 'vehicle_class', 'Unknown') as vehicle_segment,
      count(*)::integer as approved_layout_samples
    from public.policy_ocr_training_labels tl
    where tl.status = 'approved'
    group by tl.insurer_name, tl.policy_product, coalesce(tl.section_02_reference ->> 'vehicle_class', 'Unknown')
  ),
  ranked_families as (
    select
      pf.*,
      coalesce(ac.approved_layout_samples, 0) as approved_layout_samples,
      row_number() over (
        partition by pf.insurer_name
        order by
          case when pf.policies_with_pdf >= v_per_family then 0 else 1 end,
          pf.production_count desc,
          pf.policies_with_pdf desc,
          pf.policy_product,
          pf.vehicle_segment
      ) as family_rank
    from production_families pf
    join top_insurers ti on ti.insurer_name = pf.insurer_name
    left join approved_counts ac
      on ac.insurer_name = pf.insurer_name
     and ac.policy_product = pf.policy_product
     and ac.vehicle_segment = pf.vehicle_segment
  ),
  selected_families as (
    select * from ranked_families where family_rank = 1
  ),
  candidate_documents as (
    select
      sf.insurer_name,
      sf.policy_product,
      sf.vehicle_segment,
      sf.production_count,
      sf.policies_with_pdf,
      sf.approved_layout_samples,
      case when sf.approved_layout_samples >= 4 then 'blind_holdout' else 'training' end as cohort_role,
      (sf.production_count::numeric * greatest(sf.policies_with_pdf, 1)::numeric)
        / greatest(sf.approved_layout_samples + 1, 1)::numeric as priority_score,
      d.id as policy_document_id,
      tl.id as training_label_id,
      row_number() over (
        partition by sf.insurer_name, sf.policy_product, sf.vehicle_segment
        order by p.issuance_date desc nulls last, p.created_at desc, d.created_at desc
      ) as candidate_rank
    from selected_families sf
    join public.insurance_companies i on i.name = sf.insurer_name
    join public.policies p
      on p.insurance_company_id = i.id
     and coalesce(p.policy_type, 'Unknown') = sf.policy_product
    left join public.vehicles v on v.id = p.vehicle_id
    join public.policy_documents d
      on d.policy_id = p.id
     and d.document_type = 'policy_copy'
     and d.mime_type = 'application/pdf'
    join public.policy_ocr_training_labels tl on tl.policy_document_id = d.id
    where coalesce(v.vehicle_type, v.vehicle_category, v.vehicle_class_code, 'Unknown') = sf.vehicle_segment
      and tl.status <> 'approved'
      and tl.processing_status <> 'processing'
      and not exists (
        select 1 from public.policy_ocr_benchmark_items previous
        where previous.policy_document_id = d.id
      )
  )
  insert into public.policy_ocr_benchmark_items (
    run_id, training_label_id, policy_document_id, public_key,
    insurer_name, policy_product, vehicle_segment, cohort_role,
    production_count, policies_with_pdf, approved_layout_samples, priority_score
  )
  select
    v_run_id,
    c.training_label_id,
    c.policy_document_id,
    left(encode(digest(v_run_id::text || ':' || c.policy_document_id::text, 'sha256'), 'hex'), 12),
    c.insurer_name,
    c.policy_product,
    c.vehicle_segment,
    c.cohort_role,
    c.production_count,
    c.policies_with_pdf,
    c.approved_layout_samples,
    c.priority_score
  from candidate_documents c
  where c.candidate_rank <= v_per_family;

  get diagnostics v_item_count = row_count;

  select coalesce(jsonb_agg(jsonb_build_object(
    'insurer', x.insurer_name,
    'policy_product', x.policy_product,
    'vehicle_segment', x.vehicle_segment,
    'production_count', x.production_count,
    'policies_with_pdf', x.policies_with_pdf
  ) order by x.production_count desc), '[]'::jsonb)
  into v_data_gap
  from (
    select * from (
      select
        pf.*,
        row_number() over (partition by pf.insurer_name order by pf.production_count desc) as rn
      from production_families pf
      join top_insurers ti on ti.insurer_name = pf.insurer_name
    ) ranked
    where ranked.rn = 1 and ranked.policies_with_pdf = 0
  ) x;

  update public.policy_ocr_benchmark_runs
  set status = case when v_item_count = 0 then 'blocked' else 'selected' end,
      summary = jsonb_build_object(
        'selected_items', v_item_count,
        'top_insurer_data_gaps', v_data_gap,
        'selection_rule', 'top five insurers; highest-volume family with enough stored fresh PDFs; >=4 approved samples becomes blind holdout'
      ),
      updated_at = now()
  where id = v_run_id;

  return v_run_id;
end;
$$;

revoke all on function public.create_policy_ocr_production_benchmark_run(uuid, integer) from public, anon, authenticated;
grant execute on function public.create_policy_ocr_production_benchmark_run(uuid, integer) to service_role;
