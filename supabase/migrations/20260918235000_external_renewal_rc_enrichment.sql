begin;

alter table public.external_renewal_opportunities
  add column if not exists rc_enrichment_status text not null default 'not_fetched',
  add column if not exists rc_enrichment_source text,
  add column if not exists rc_enrichment_details jsonb not null default '{}'::jsonb,
  add column if not exists rc_enriched_at timestamptz,
  add column if not exists rc_enrichment_error_code text;

alter table public.external_renewal_opportunities
  drop constraint if exists external_renewal_opportunities_rc_enrichment_status_check;

alter table public.external_renewal_opportunities
  add constraint external_renewal_opportunities_rc_enrichment_status_check
  check (rc_enrichment_status in ('not_fetched','ready','no_data','failed'));

alter table public.external_renewal_opportunities
  drop constraint if exists external_renewal_opportunities_rc_enrichment_source_check;

alter table public.external_renewal_opportunities
  add constraint external_renewal_opportunities_rc_enrichment_source_check
  check (rc_enrichment_source is null or rc_enrichment_source in ('local_cache','authbridge','stale_cache'));

create index if not exists external_renewal_opportunities_rc_enrichment_idx
  on public.external_renewal_opportunities (rc_enrichment_status, policy_end_date)
  where is_active;

comment on column public.external_renewal_opportunities.rc_enrichment_details is
  'Privacy-minimized AuthBridge-derived RC snapshot for External Renewal AI context only. Never stores raw provider payload, owner identity, address or unrelated private fields.';

commit;
