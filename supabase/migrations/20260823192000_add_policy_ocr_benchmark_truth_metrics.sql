alter table public.policy_ocr_benchmark_items
  add column if not exists truth_status text not null default 'pending',
  add column if not exists truth_fields jsonb,
  add column if not exists truth_source text,
  add column if not exists truth_verified_by uuid,
  add column if not exists truth_verified_at timestamptz,
  add column if not exists baseline_metrics jsonb;

alter table public.policy_ocr_benchmark_items
  drop constraint if exists policy_ocr_benchmark_items_truth_status_check;

alter table public.policy_ocr_benchmark_items
  add constraint policy_ocr_benchmark_items_truth_status_check
  check (truth_status in ('pending','verified','sealed_holdout'));

update public.policy_ocr_benchmark_items
set truth_status = 'sealed_holdout'
where cohort_role = 'blind_holdout'
  and truth_status = 'pending';

create index if not exists policy_ocr_benchmark_items_truth_status_idx
  on public.policy_ocr_benchmark_items (run_id, truth_status);
