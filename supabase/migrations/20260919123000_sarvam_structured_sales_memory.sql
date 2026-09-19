begin;

alter table public.external_renewal_voice_attempts
  add column if not exists sales_memory jsonb not null default '{}'::jsonb;

comment on column public.external_renewal_voice_attempts.sales_memory is
  'Normalized structured sales memory extracted from Sarvam output variables. No raw transcript. Used to avoid re-asking already known renewal preferences on later connected calls.';

commit;
