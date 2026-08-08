begin;

-- Expand the existing OEM lookup into a durable vehicle-manufacturer master.
-- Existing rows/data are intentionally preserved in this foundation migration.
alter table public.vehicle_manufacturers
  add column if not exists manufacturer_code text,
  add column if not exists display_name text,
  add column if not exists parent_group_name text,
  add column if not exists country_of_origin text,
  add column if not exists india_presence_type text,
  add column if not exists website_url text,
  add column if not exists market_status text not null default 'current',
  add column if not exists logo_source_url text,
  add column if not exists logo_status text not null default 'missing',
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists source_verified_at timestamptz,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

update public.vehicle_manufacturers
set
  display_name = coalesce(nullif(trim(display_name), ''), name),
  logo_status = case when nullif(trim(logo_path), '') is not null then 'verified' else 'missing' end
where display_name is null
   or trim(display_name) = ''
   or logo_status is null
   or logo_status not in ('verified', 'needs_review', 'missing');

alter table public.vehicle_manufacturers
  alter column display_name set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicle_manufacturers_market_status_check'
      and conrelid = 'public.vehicle_manufacturers'::regclass
  ) then
    alter table public.vehicle_manufacturers
      add constraint vehicle_manufacturers_market_status_check
      check (market_status in ('current', 'legacy', 'ceased', 'pending_review'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'vehicle_manufacturers_logo_status_check'
      and conrelid = 'public.vehicle_manufacturers'::regclass
  ) then
    alter table public.vehicle_manufacturers
      add constraint vehicle_manufacturers_logo_status_check
      check (logo_status in ('verified', 'needs_review', 'missing'));
  end if;
end
$$;

create unique index if not exists vehicle_manufacturers_manufacturer_code_key
  on public.vehicle_manufacturers (lower(manufacturer_code))
  where manufacturer_code is not null;

create index if not exists vehicle_manufacturers_display_name_idx
  on public.vehicle_manufacturers (lower(display_name));

create index if not exists vehicle_manufacturers_market_status_idx
  on public.vehicle_manufacturers (market_status, is_active);

create table if not exists public.vehicle_manufacturer_segments (
  manufacturer_id uuid not null references public.vehicle_manufacturers(id) on delete cascade,
  segment_code text not null,
  created_at timestamptz not null default now(),
  primary key (manufacturer_id, segment_code),
  constraint vehicle_manufacturer_segments_code_check check (
    segment_code in (
      'PASSENGER_VEHICLE',
      'COMMERCIAL_VEHICLE',
      'TWO_WHEELER',
      'THREE_WHEELER',
      'ELECTRIC_VEHICLE',
      'TRACTOR_AGRICULTURAL',
      'CONSTRUCTION_EQUIPMENT',
      'EARTHMOVING_MINING',
      'MATERIAL_HANDLING',
      'SPECIAL_PURPOSE'
    )
  )
);

create index if not exists vehicle_manufacturer_segments_segment_idx
  on public.vehicle_manufacturer_segments (segment_code, manufacturer_id);

create table if not exists public.vehicle_manufacturer_brands (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.vehicle_manufacturers(id) on delete cascade,
  brand_name text not null,
  slug text,
  logo_path text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicle_manufacturer_brands_name_key
  on public.vehicle_manufacturer_brands (manufacturer_id, lower(brand_name));

create unique index if not exists vehicle_manufacturer_brands_slug_key
  on public.vehicle_manufacturer_brands (lower(slug))
  where slug is not null;

create index if not exists vehicle_manufacturer_brands_lookup_idx
  on public.vehicle_manufacturer_brands (lower(brand_name), is_active);

create table if not exists public.vehicle_manufacturer_aliases (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.vehicle_manufacturers(id) on delete cascade,
  alias text not null,
  source text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists vehicle_manufacturer_aliases_name_key
  on public.vehicle_manufacturer_aliases (manufacturer_id, lower(alias));

create index if not exists vehicle_manufacturer_aliases_lookup_idx
  on public.vehicle_manufacturer_aliases (lower(alias), is_active);

alter table public.vehicle_manufacturer_segments enable row level security;
alter table public.vehicle_manufacturer_brands enable row level security;
alter table public.vehicle_manufacturer_aliases enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_manufacturer_segments'
      and policyname = 'Authenticated users can read vehicle manufacturer segments'
  ) then
    create policy "Authenticated users can read vehicle manufacturer segments"
      on public.vehicle_manufacturer_segments
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_manufacturer_brands'
      and policyname = 'Authenticated users can read vehicle manufacturer brands'
  ) then
    create policy "Authenticated users can read vehicle manufacturer brands"
      on public.vehicle_manufacturer_brands
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehicle_manufacturer_aliases'
      and policyname = 'Authenticated users can read vehicle manufacturer aliases'
  ) then
    create policy "Authenticated users can read vehicle manufacturer aliases"
      on public.vehicle_manufacturer_aliases
      for select
      to authenticated
      using (true);
  end if;
end
$$;

drop trigger if exists vehicle_manufacturer_brands_updated_at on public.vehicle_manufacturer_brands;
create trigger vehicle_manufacturer_brands_updated_at
before update on public.vehicle_manufacturer_brands
for each row execute function public.set_updated_at();

drop trigger if exists vehicle_manufacturer_aliases_updated_at on public.vehicle_manufacturer_aliases;
create trigger vehicle_manufacturer_aliases_updated_at
before update on public.vehicle_manufacturer_aliases
for each row execute function public.set_updated_at();

-- Preserve customer-vehicle compatibility while decoupling RC/vehicle make values
-- from the registered legal entity name. A vehicle make may match a legal entity,
-- a display name, a brand or an explicitly reviewed alias.
create or replace function public.validate_vehicle_manufacturer()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized_make text;
begin
  if new.make is null or trim(new.make) = '' then
    return new;
  end if;

  normalized_make := regexp_replace(lower(new.make), '[^a-z0-9]+', '', 'g');

  if exists (
    select 1
    from public.vehicle_manufacturers vm
    where vm.is_active = true
      and (
        regexp_replace(lower(vm.name), '[^a-z0-9]+', '', 'g') = normalized_make
        or regexp_replace(lower(vm.display_name), '[^a-z0-9]+', '', 'g') = normalized_make
      )
  ) or exists (
    select 1
    from public.vehicle_manufacturer_brands vb
    join public.vehicle_manufacturers vm on vm.id = vb.manufacturer_id
    where vm.is_active = true
      and vb.is_active = true
      and regexp_replace(lower(vb.brand_name), '[^a-z0-9]+', '', 'g') = normalized_make
  ) or exists (
    select 1
    from public.vehicle_manufacturer_aliases va
    join public.vehicle_manufacturers vm on vm.id = va.manufacturer_id
    where vm.is_active = true
      and va.is_active = true
      and regexp_replace(lower(va.alias), '[^a-z0-9]+', '', 'g') = normalized_make
  ) then
    return new;
  end if;

  raise exception 'Unknown vehicle manufacturer: %', new.make;
end;
$$;

commit;
