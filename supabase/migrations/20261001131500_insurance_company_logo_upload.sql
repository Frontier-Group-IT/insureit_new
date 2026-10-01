-- Managed insurer logos: additive and backwards-compatible.
-- Existing repository-bundled insurer logos remain the application fallback.

alter table public.insurance_companies
  add column if not exists logo_path text;

comment on column public.insurance_companies.logo_path is
  'Object path in the public insurer-assets Supabase Storage bucket. Null uses the bundled/static logo fallback.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'insurer-assets',
  'insurer-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do nothing;
