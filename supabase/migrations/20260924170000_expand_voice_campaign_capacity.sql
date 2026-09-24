begin;

alter table public.voice_campaigns
  drop constraint if exists voice_campaigns_total_rows_check,
  drop constraint if exists voice_campaigns_accepted_rows_check,
  drop constraint if exists voice_campaigns_rejected_rows_check,
  drop constraint if exists voice_campaigns_duplicate_rows_check,
  drop constraint if exists voice_campaigns_enriched_rows_check;

alter table public.voice_campaigns
  add constraint voice_campaigns_total_rows_check check (total_rows between 0 and 500),
  add constraint voice_campaigns_accepted_rows_check check (accepted_rows between 0 and 500),
  add constraint voice_campaigns_rejected_rows_check check (rejected_rows between 0 and 500),
  add constraint voice_campaigns_duplicate_rows_check check (duplicate_rows between 0 and 500),
  add constraint voice_campaigns_enriched_rows_check check (enriched_rows between 0 and 500);

comment on table public.voice_campaigns is
  'IT-controlled AI renewal campaigns. Maximum 500 uploaded source rows; repeated Tata Commercial vehicle rows may be grouped to one callable mobile prospect.';

commit;
