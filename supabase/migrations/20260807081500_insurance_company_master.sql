-- Production migration history alignment for the canonical insurance company master.
-- This is the schema portion applied to Supabase before the canonical seed.

alter table public.insurance_companies
  add column if not exists segment text,
  add column if not exists sibpl_code text,
  add column if not exists portal_url text,
  add column if not exists portal_status text not null default 'not_provided',
  add column if not exists is_active boolean not null default true;
