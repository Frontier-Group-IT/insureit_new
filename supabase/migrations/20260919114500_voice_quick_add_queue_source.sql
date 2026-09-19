begin;

alter table public.external_renewal_opportunities
  add column if not exists voice_queue_source text not null default 'import',
  add column if not exists quick_add_by_auth_user_id uuid,
  add column if not exists quick_added_at timestamptz;

alter table public.external_renewal_opportunities
  drop constraint if exists external_renewal_opportunities_voice_queue_source_check;

alter table public.external_renewal_opportunities
  add constraint external_renewal_opportunities_voice_queue_source_check
  check (voice_queue_source in ('import','it_quick_add'));

create index if not exists external_renewal_it_quick_add_idx
  on public.external_renewal_opportunities (quick_added_at desc)
  where voice_queue_source = 'it_quick_add' and is_active;

comment on column public.external_renewal_opportunities.voice_queue_source is
  'Controls IT Voice Integration queue inclusion. it_quick_add means explicitly added by IT Super User and does not convert the row into verified INSUREIT business.';
comment on column public.external_renewal_opportunities.quick_add_by_auth_user_id is
  'Authenticated IT operator who explicitly added/promoted this isolated External Renewal opportunity into the Voice Integration queue.';

commit;
