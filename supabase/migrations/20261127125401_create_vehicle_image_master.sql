-- Additive vehicle artwork infrastructure; no updates to existing business rows.
create table public.vehicle_image_master (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.vehicle_manufacturers(id) on delete restrict,
  model_key text not null check (length(model_key) between 1 and 240 and model_key = lower(btrim(regexp_replace(model_key, '[[:space:]]+', ' ', 'g')))),
  variant_key text check (variant_key is null or (length(variant_key) between 1 and 240 and variant_key = lower(btrim(regexp_replace(variant_key, '[[:space:]]+', ' ', 'g'))))),
  model_year integer check (model_year between 1900 and 2100),
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  image_width integer not null check (image_width between 1 and 1200),
  image_height integer not null check (image_height between 1 and 900),
  file_size integer not null check (file_size between 1 and 2097152),
  version uuid not null default gen_random_uuid(),
  is_active boolean not null default true,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index vehicle_image_master_active_identity_uq
  on public.vehicle_image_master (manufacturer_id, model_key, variant_key, model_year) nulls not distinct
  where is_active;
create index vehicle_image_master_content_hash_idx on public.vehicle_image_master(content_hash);
alter table public.vehicle_image_master enable row level security;
revoke all on public.vehicle_image_master from public, anon, authenticated;
grant select, insert, update, delete on public.vehicle_image_master to service_role;
-- Direct client access is intentionally denied; future server routes must authorize
-- management and customer scope before using the server-only service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-images','vehicle-images',false,2097152,array['image/webp']);
-- Restrictive bucket-specific guard: existing policies keep their current behavior.
create policy vehicle_images_server_only on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'vehicle-images')
  with check (bucket_id <> 'vehicle-images');
