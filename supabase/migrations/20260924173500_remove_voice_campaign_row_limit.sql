begin;

alter table public.voice_campaigns
  drop constraint if exists voice_campaigns_total_rows_check,
  drop constraint if exists voice_campaigns_accepted_rows_check,
  drop constraint if exists voice_campaigns_rejected_rows_check,
  drop constraint if exists voice_campaigns_duplicate_rows_check,
  drop constraint if exists voice_campaigns_enriched_rows_check;

alter table public.voice_campaigns
  add constraint voice_campaigns_total_rows_check check (total_rows >= 0),
  add constraint voice_campaigns_accepted_rows_check check (accepted_rows >= 0),
  add constraint voice_campaigns_rejected_rows_check check (rejected_rows >= 0),
  add constraint voice_campaigns_duplicate_rows_check check (duplicate_rows >= 0),
  add constraint voice_campaigns_enriched_rows_check check (enriched_rows >= 0);

comment on table public.voice_campaigns is
  'IT-controlled AI renewal campaigns. Campaign size is governed by upload/file processing capacity rather than a fixed customer-count ceiling.';

commit;
