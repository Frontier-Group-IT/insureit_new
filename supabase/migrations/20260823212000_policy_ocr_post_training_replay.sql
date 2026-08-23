alter table public.policy_ocr_benchmark_items
  add column if not exists post_training_status text not null default 'pending',
  add column if not exists post_training_proposal jsonb,
  add column if not exists post_training_parser_id text,
  add column if not exists post_training_parser_version text,
  add column if not exists post_training_extraction_method text,
  add column if not exists post_training_failure_code text,
  add column if not exists post_training_captured_at timestamptz,
  add column if not exists post_training_metrics jsonb,
  add column if not exists post_training_field_results jsonb;

alter table public.policy_ocr_benchmark_items
  drop constraint if exists policy_ocr_benchmark_items_post_training_status_check;

alter table public.policy_ocr_benchmark_items
  add constraint policy_ocr_benchmark_items_post_training_status_check
  check (post_training_status in ('pending', 'processing', 'ready', 'failed'));

create index if not exists policy_ocr_benchmark_items_post_training_queue_idx
  on public.policy_ocr_benchmark_items (run_id, cohort_role, post_training_status, priority_score desc, created_at asc);

comment on column public.policy_ocr_benchmark_items.post_training_proposal is
  'Fresh parser replay captured after a training refinement. Kept separate from the immutable baseline proposal.';
comment on column public.policy_ocr_benchmark_items.post_training_metrics is
  'Metrics computed only against PDF-verified benchmark truth for the training cohort.';
comment on column public.policy_ocr_benchmark_items.post_training_field_results is
  'Per-field replay comparison against PDF-verified truth. Blind holdouts remain untouched until explicitly unsealed later.';
