-- InsureIT Exchange marketplace backend foundation
-- Core goal: secure customer-to-customer commercial vehicle marketplace with
-- controlled bidding/contact and InsureIT-mediated deal progression.

create sequence if not exists public.exchange_listing_no_seq start 1001;
create sequence if not exists public.exchange_deal_no_seq start 1001;

create table if not exists public.exchange_listings (
  id uuid primary key default gen_random_uuid(),
  listing_no text not null unique default (
    'EX-' || to_char(current_date, 'YYMM') || '-' ||
    lpad(nextval('public.exchange_listing_no_seq')::text, 6, '0')
  ),
  seller_customer_id uuid not null references public.customers(id) on delete restrict,
  seller_profile_id uuid not null references public.profiles(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','pending_review','live','paused','deal_in_progress','sold','withdrawn','rejected','expired')),
  selling_mode text not null default 'open_bidding'
    check (selling_mode in ('fixed_price','open_bidding','managed_auction')),
  title text not null,
  category text not null
    check (category in ('Truck','Tipper','Pickup','Bus','Construction','Other')),
  city text,
  state text,
  odometer_km bigint check (odometer_km is null or odometer_km >= 0),
  asking_price numeric(14,2) not null default 0 check (asking_price >= 0),
  opening_bid numeric(14,2) not null default 0 check (opening_bid >= 0),
  reserve_price numeric(14,2) check (reserve_price is null or reserve_price >= 0),
  min_bid_increment numeric(14,2) not null default 10000 check (min_bid_increment > 0),
  current_bid numeric(14,2) not null default 0 check (current_bid >= 0),
  bid_count integer not null default 0 check (bid_count >= 0),
  auction_ends_at timestamptz,
  condition_details jsonb not null default '{}'::jsonb,
  ownership_count integer check (ownership_count is null or ownership_count >= 1),
  tyre_condition_percent integer check (tyre_condition_percent is null or tyre_condition_percent between 0 and 100),
  permit_summary text,
  finance_summary text,
  seller_declaration jsonb not null default '{}'::jsonb,
  owner_verification_status text not null default 'verified'
    check (owner_verification_status in ('pending','verified','rejected')),
  document_verification_status text not null default 'pending'
    check (document_verification_status in ('pending','in_review','verified','rejected')),
  inspection_status text not null default 'not_requested'
    check (inspection_status in ('not_requested','requested','scheduled','completed','failed','waived')),
  inspection_score integer check (inspection_score is null or inspection_score between 0 and 100),
  review_notes text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  expires_at timestamptz,
  sold_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exchange_one_active_listing_per_vehicle_idx
  on public.exchange_listings(vehicle_id)
  where status in ('pending_review','live','paused','deal_in_progress');

create index if not exists exchange_listings_live_idx
  on public.exchange_listings(status, published_at desc);
create index if not exists exchange_listings_category_idx
  on public.exchange_listings(category, status, published_at desc);
create index if not exists exchange_listings_seller_idx
  on public.exchange_listings(seller_customer_id, created_at desc);
create index if not exists exchange_listings_vehicle_idx
  on public.exchange_listings(vehicle_id);

create table if not exists public.exchange_listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.exchange_listings(id) on delete cascade,
  media_type text not null default 'photo' check (media_type in ('photo','video')),
  label text,
  storage_bucket text not null default 'exchange-media',
  storage_path text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(listing_id, storage_path)
);

create index if not exists exchange_listing_media_listing_idx
  on public.exchange_listing_media(listing_id, sort_order, created_at);

create table if not exists public.exchange_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.exchange_listings(id) on delete restrict,
  bidder_customer_id uuid not null references public.customers(id) on delete restrict,
  bidder_profile_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'leading'
    check (status in ('leading','outbid','accepted','rejected','withdrawn')),
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exchange_bids_listing_idx
  on public.exchange_bids(listing_id, amount desc, placed_at desc);
create index if not exists exchange_bids_bidder_idx
  on public.exchange_bids(bidder_customer_id, placed_at desc);
create unique index if not exists exchange_one_leading_bid_idx
  on public.exchange_bids(listing_id)
  where status = 'leading';

alter table public.exchange_listings
  add column if not exists highest_bid_id uuid references public.exchange_bids(id) on delete set null;

create table if not exists public.exchange_favorites (
  listing_id uuid not null references public.exchange_listings(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, customer_id)
);

create index if not exists exchange_favorites_profile_idx
  on public.exchange_favorites(profile_id, created_at desc);

create table if not exists public.exchange_contact_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.exchange_listings(id) on delete restrict,
  buyer_customer_id uuid not null references public.customers(id) on delete restrict,
  buyer_profile_id uuid not null references public.profiles(id) on delete restrict,
  request_type text not null default 'managed_callback'
    check (request_type in ('managed_callback','inspection_visit','ask_question')),
  message text,
  status text not null default 'pending'
    check (status in ('pending','seller_accepted','seller_declined','connected','closed','cancelled')),
  seller_responded_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exchange_contact_open_request_idx
  on public.exchange_contact_requests(listing_id, buyer_customer_id, request_type)
  where status in ('pending','seller_accepted','connected');

create index if not exists exchange_contact_listing_idx
  on public.exchange_contact_requests(listing_id, created_at desc);

create table if not exists public.exchange_deals (
  id uuid primary key default gen_random_uuid(),
  deal_no text not null unique default (
    'XD-' || to_char(current_date, 'YYMM') || '-' ||
    lpad(nextval('public.exchange_deal_no_seq')::text, 6, '0')
  ),
  listing_id uuid not null unique references public.exchange_listings(id) on delete restrict,
  accepted_bid_id uuid not null unique references public.exchange_bids(id) on delete restrict,
  seller_customer_id uuid not null references public.customers(id) on delete restrict,
  buyer_customer_id uuid not null references public.customers(id) on delete restrict,
  agreed_price numeric(14,2) not null check (agreed_price > 0),
  status text not null default 'seller_accepted'
    check (status in (
      'seller_accepted','buyer_confirmed','inspection_pending','inspection_complete',
      'payment_pending','handover_pending','rc_transfer_pending','completed','cancelled','disputed'
    )),
  buyer_confirmed_at timestamptz,
  inspection_completed_at timestamptz,
  payment_confirmed_at timestamptz,
  handover_completed_at timestamptz,
  rc_transfer_completed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exchange_deals_buyer_idx
  on public.exchange_deals(buyer_customer_id, created_at desc);
create index if not exists exchange_deals_seller_idx
  on public.exchange_deals(seller_customer_id, created_at desc);

create table if not exists public.exchange_events (
  id bigint generated always as identity primary key,
  listing_id uuid references public.exchange_listings(id) on delete cascade,
  deal_id uuid references public.exchange_deals(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_customer_id uuid references public.customers(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists exchange_events_listing_idx
  on public.exchange_events(listing_id, created_at desc);
create index if not exists exchange_events_deal_idx
  on public.exchange_events(deal_id, created_at desc);

alter table public.exchange_listings enable row level security;
alter table public.exchange_listing_media enable row level security;
alter table public.exchange_bids enable row level security;
alter table public.exchange_favorites enable row level security;
alter table public.exchange_contact_requests enable row level security;
alter table public.exchange_deals enable row level security;
alter table public.exchange_events enable row level security;

revoke all on public.exchange_listings from anon, authenticated;
revoke all on public.exchange_listing_media from anon, authenticated;
revoke all on public.exchange_bids from anon, authenticated;
revoke all on public.exchange_favorites from anon, authenticated;
revoke all on public.exchange_contact_requests from anon, authenticated;
revoke all on public.exchange_deals from anon, authenticated;
revoke all on public.exchange_events from anon, authenticated;
grant usage, select on sequence public.exchange_listing_no_seq to authenticated;
grant usage, select on sequence public.exchange_deal_no_seq to authenticated;

create or replace function public.exchange_is_staff()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(public.current_app_role()::text in (
    'super_admin','admin','it_super_user','director','manager','backoffice_executive'
  ), false);
$function$;

create or replace function public.exchange_mask_registration(p_vehicle_no text)
returns text
language plpgsql
immutable
as $function$
declare
  v text := regexp_replace(upper(coalesce(p_vehicle_no,'')), '[^A-Z0-9-]', '', 'g');
begin
  if v = '' then return 'Registration masked'; end if;
  if v like 'NEW-%' then
    return 'NEW-••••' || right(v, greatest(least(length(v) - 4, 4), 1));
  end if;
  if length(v) <= 6 then
    return left(v, 2) || '••' || right(v, 2);
  end if;
  return left(v, 4) || '•••' || right(v, 4);
end;
$function$;

create or replace function public.exchange_touch_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists exchange_listings_touch_updated_at on public.exchange_listings;
create trigger exchange_listings_touch_updated_at
before update on public.exchange_listings
for each row execute function public.exchange_touch_updated_at();

drop trigger if exists exchange_bids_touch_updated_at on public.exchange_bids;
create trigger exchange_bids_touch_updated_at
before update on public.exchange_bids
for each row execute function public.exchange_touch_updated_at();

drop trigger if exists exchange_contact_touch_updated_at on public.exchange_contact_requests;
create trigger exchange_contact_touch_updated_at
before update on public.exchange_contact_requests
for each row execute function public.exchange_touch_updated_at();

drop trigger if exists exchange_deals_touch_updated_at on public.exchange_deals;
create trigger exchange_deals_touch_updated_at
before update on public.exchange_deals
for each row execute function public.exchange_touch_updated_at();

create or replace function public.exchange_marketplace_feed(
  p_category text default null,
  p_query text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns table (
  listing_id uuid,
  listing_no text,
  title text,
  category text,
  year integer,
  odometer_km bigint,
  city text,
  state text,
  asking_price numeric,
  current_bid numeric,
  bid_count integer,
  min_bid_increment numeric,
  auction_ends_at timestamptz,
  owner_verified boolean,
  documents_verified boolean,
  inspected boolean,
  inspection_score integer,
  masked_registration text,
  fuel_type text,
  ownership_count integer,
  tyre_condition_percent integer,
  permit_summary text,
  finance_summary text,
  make text,
  model text,
  vehicle_type text,
  cover_storage_bucket text,
  cover_storage_path text,
  is_favorite boolean
)
language sql
stable security definer
set search_path to 'public','auth'
as $function$
  select
    l.id,
    l.listing_no,
    l.title,
    l.category,
    v.year,
    l.odometer_km,
    l.city,
    l.state,
    l.asking_price,
    l.current_bid,
    l.bid_count,
    l.min_bid_increment,
    l.auction_ends_at,
    l.owner_verification_status = 'verified',
    l.document_verification_status = 'verified',
    l.inspection_status = 'completed',
    l.inspection_score,
    public.exchange_mask_registration(v.vehicle_no),
    v.fuel_type,
    l.ownership_count,
    l.tyre_condition_percent,
    l.permit_summary,
    l.finance_summary,
    v.make,
    v.model,
    v.vehicle_type,
    media.storage_bucket,
    media.storage_path,
    exists (
      select 1
      from public.exchange_favorites f
      where f.listing_id = l.id
        and f.profile_id = auth.uid()
    )
  from public.exchange_listings l
  join public.vehicles v on v.id = l.vehicle_id
  left join lateral (
    select m.storage_bucket, m.storage_path
    from public.exchange_listing_media m
    where m.listing_id = l.id
    order by m.is_cover desc, m.sort_order asc, m.created_at asc
    limit 1
  ) media on true
  where l.status = 'live'
    and (l.auction_ends_at is null or l.auction_ends_at > now())
    and (p_category is null or p_category = '' or p_category = 'All' or l.category = p_category)
    and (
      p_query is null or btrim(p_query) = ''
      or l.title ilike '%' || btrim(p_query) || '%'
      or coalesce(l.city,'') ilike '%' || btrim(p_query) || '%'
      or coalesce(l.state,'') ilike '%' || btrim(p_query) || '%'
      or coalesce(v.make,'') ilike '%' || btrim(p_query) || '%'
      or coalesce(v.model,'') ilike '%' || btrim(p_query) || '%'
    )
  order by l.published_at desc nulls last, l.created_at desc
  limit least(greatest(coalesce(p_limit,40),1),100)
  offset greatest(coalesce(p_offset,0),0);
$function$;

create or replace function public.exchange_my_sellable_vehicles(p_customer_id uuid)
returns table (
  vehicle_id uuid,
  vehicle_no text,
  make text,
  model text,
  year integer,
  vehicle_type text,
  vehicle_category text,
  fuel_type text,
  body_type text,
  city text,
  state text,
  has_active_listing boolean
)
language plpgsql
stable security definer
set search_path to 'public','auth'
as $function$
begin
  if auth.uid() is null or not public.can_access_customer(p_customer_id) then
    raise exception 'Customer account is not available to the signed-in user.' using errcode='42501';
  end if;

  return query
  select
    v.id,
    v.vehicle_no,
    v.make,
    v.model,
    v.year,
    v.vehicle_type,
    v.vehicle_category,
    v.fuel_type,
    v.body_type,
    c.city,
    c.state,
    exists (
      select 1 from public.exchange_listings l
      where l.vehicle_id = v.id
        and l.status in ('pending_review','live','paused','deal_in_progress')
    )
  from public.vehicles v
  join public.customers c on c.id = v.customer_id
  where v.customer_id = p_customer_id
  order by v.updated_at desc, v.vehicle_no;
end;
$function$;

create or replace function public.exchange_upsert_listing_draft(
  p_listing_id uuid,
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_title text,
  p_category text,
  p_odometer_km bigint,
  p_asking_price numeric,
  p_opening_bid numeric default 0,
  p_min_bid_increment numeric default 10000,
  p_ownership_count integer default null,
  p_tyre_condition_percent integer default null,
  p_permit_summary text default null,
  p_finance_summary text default null,
  p_condition_details jsonb default '{}'::jsonb,
  p_seller_declaration jsonb default '{}'::jsonb
)
returns public.exchange_listings
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_city text;
  v_state text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode='42501';
  end if;
  if not public.can_access_customer(p_customer_id) then
    raise exception 'Customer account is not available to the signed-in user.' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.vehicles v
    where v.id = p_vehicle_id and v.customer_id = p_customer_id
  ) then
    raise exception 'Only the current vehicle owner can create this listing.' using errcode='42501';
  end if;
  if p_category not in ('Truck','Tipper','Pickup','Bus','Construction','Other') then
    raise exception 'Select a valid marketplace category.';
  end if;
  if coalesce(p_asking_price,0) < 0 or coalesce(p_opening_bid,0) < 0 then
    raise exception 'Price values cannot be negative.';
  end if;
  if coalesce(p_min_bid_increment,0) <= 0 then
    raise exception 'Bid increment must be greater than zero.';
  end if;

  select c.city, c.state into v_city, v_state
  from public.customers c where c.id = p_customer_id;

  if p_listing_id is null then
    insert into public.exchange_listings (
      seller_customer_id, seller_profile_id, vehicle_id, title, category, city, state,
      odometer_km, asking_price, opening_bid, min_bid_increment, ownership_count,
      tyre_condition_percent, permit_summary, finance_summary, condition_details,
      seller_declaration
    ) values (
      p_customer_id, auth.uid(), p_vehicle_id,
      coalesce(nullif(btrim(p_title),''), 'Commercial vehicle'),
      p_category, v_city, v_state, p_odometer_km, coalesce(p_asking_price,0),
      coalesce(p_opening_bid,0), coalesce(p_min_bid_increment,10000),
      p_ownership_count, p_tyre_condition_percent, nullif(btrim(p_permit_summary),''),
      nullif(btrim(p_finance_summary),''), coalesce(p_condition_details,'{}'::jsonb),
      coalesce(p_seller_declaration,'{}'::jsonb)
    )
    returning * into v_listing;

    insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type)
    values(v_listing.id,auth.uid(),p_customer_id,'listing_draft_created');
  else
    select * into v_listing
    from public.exchange_listings l
    where l.id = p_listing_id
    for update;

    if not found then raise exception 'Listing not found.'; end if;
    if not public.can_access_customer(v_listing.seller_customer_id) then
      raise exception 'You cannot edit this listing.' using errcode='42501';
    end if;
    if v_listing.status not in ('draft','rejected','paused') then
      raise exception 'This listing cannot be edited in its current status.';
    end if;

    update public.exchange_listings
    set vehicle_id = p_vehicle_id,
        title = coalesce(nullif(btrim(p_title),''), title),
        category = p_category,
        city = v_city,
        state = v_state,
        odometer_km = p_odometer_km,
        asking_price = coalesce(p_asking_price,asking_price),
        opening_bid = coalesce(p_opening_bid,opening_bid),
        min_bid_increment = coalesce(p_min_bid_increment,min_bid_increment),
        ownership_count = p_ownership_count,
        tyre_condition_percent = p_tyre_condition_percent,
        permit_summary = nullif(btrim(p_permit_summary),''),
        finance_summary = nullif(btrim(p_finance_summary),''),
        condition_details = coalesce(p_condition_details,condition_details),
        seller_declaration = coalesce(p_seller_declaration,seller_declaration),
        status = 'draft',
        review_notes = null
    where id = p_listing_id
    returning * into v_listing;

    insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type)
    values(v_listing.id,auth.uid(),p_customer_id,'listing_draft_updated');
  end if;

  return v_listing;
end;
$function$;

create or replace function public.exchange_submit_listing(p_listing_id uuid)
returns public.exchange_listings
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
begin
  select * into v_listing
  from public.exchange_listings
  where id = p_listing_id
  for update;

  if not found then raise exception 'Listing not found.'; end if;
  if auth.uid() is null or not public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'You cannot submit this listing.' using errcode='42501';
  end if;
  if v_listing.status not in ('draft','rejected','paused') then
    raise exception 'This listing cannot be submitted in its current status.';
  end if;
  if v_listing.asking_price <= 0 then raise exception 'Expected price is required.'; end if;
  if v_listing.odometer_km is null then raise exception 'Odometer reading is required.'; end if;

  update public.exchange_listings
  set status='pending_review', submitted_at=now(), review_notes=null
  where id=p_listing_id
  returning * into v_listing;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type)
  values(v_listing.id,auth.uid(),v_listing.seller_customer_id,'listing_submitted');

  return v_listing;
end;
$function$;

create or replace function public.exchange_review_listing(
  p_listing_id uuid,
  p_approve boolean,
  p_notes text default null,
  p_auction_ends_at timestamptz default null,
  p_document_verified boolean default false,
  p_inspection_score integer default null
)
returns public.exchange_listings
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
begin
  if auth.uid() is null or not public.exchange_is_staff() then
    raise exception 'Exchange review access required.' using errcode='42501';
  end if;

  select * into v_listing
  from public.exchange_listings
  where id=p_listing_id
  for update;

  if not found then raise exception 'Listing not found.'; end if;
  if v_listing.status <> 'pending_review' then
    raise exception 'Only pending listings can be reviewed.';
  end if;

  update public.exchange_listings
  set status = case when p_approve then 'live' else 'rejected' end,
      review_notes = nullif(btrim(p_notes),''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      published_at = case when p_approve then now() else published_at end,
      auction_ends_at = case when p_approve then coalesce(p_auction_ends_at, now()+interval '7 days') else auction_ends_at end,
      expires_at = case when p_approve then coalesce(p_auction_ends_at, now()+interval '7 days') else expires_at end,
      document_verification_status = case when p_document_verified then 'verified' else document_verification_status end,
      inspection_status = case when p_inspection_score is not null then 'completed' else inspection_status end,
      inspection_score = coalesce(p_inspection_score, inspection_score)
  where id=p_listing_id
  returning * into v_listing;

  insert into public.exchange_events(listing_id,actor_profile_id,event_type,metadata)
  values(v_listing.id,auth.uid(),case when p_approve then 'listing_approved' else 'listing_rejected' end,
    jsonb_build_object('notes',p_notes));

  return v_listing;
end;
$function$;

create or replace function public.exchange_toggle_favorite(
  p_listing_id uuid,
  p_customer_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_added boolean;
begin
  if auth.uid() is null or not public.can_access_customer(p_customer_id) then
    raise exception 'Customer account is not available to the signed-in user.' using errcode='42501';
  end if;
  if not exists(select 1 from public.exchange_listings where id=p_listing_id and status='live') then
    raise exception 'Listing is not available.';
  end if;

  if exists(
    select 1 from public.exchange_favorites
    where listing_id=p_listing_id and customer_id=p_customer_id
  ) then
    delete from public.exchange_favorites
    where listing_id=p_listing_id and customer_id=p_customer_id;
    v_added := false;
  else
    insert into public.exchange_favorites(listing_id,customer_id,profile_id)
    values(p_listing_id,p_customer_id,auth.uid())
    on conflict(listing_id,customer_id) do nothing;
    v_added := true;
  end if;
  return v_added;
end;
$function$;

create or replace function public.exchange_place_bid(
  p_listing_id uuid,
  p_buyer_customer_id uuid,
  p_amount numeric
)
returns public.exchange_bids
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_bid public.exchange_bids%rowtype;
  v_minimum numeric;
begin
  if auth.uid() is null or not public.can_access_customer(p_buyer_customer_id) then
    raise exception 'Buyer account is not available to the signed-in user.' using errcode='42501';
  end if;

  select * into v_listing
  from public.exchange_listings
  where id=p_listing_id
  for update;

  if not found or v_listing.status <> 'live' then
    raise exception 'This listing is not open for bidding.';
  end if;
  if v_listing.auction_ends_at is not null and v_listing.auction_ends_at <= now() then
    update public.exchange_listings set status='expired' where id=v_listing.id;
    raise exception 'Bidding has ended for this listing.';
  end if;
  if public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'A seller cannot bid on their own vehicle.' using errcode='42501';
  end if;

  v_minimum := case
    when v_listing.bid_count > 0 then v_listing.current_bid + v_listing.min_bid_increment
    else greatest(v_listing.opening_bid, v_listing.min_bid_increment)
  end;

  if p_amount is null or p_amount < v_minimum then
    raise exception 'Minimum next bid is %.', v_minimum;
  end if;

  update public.exchange_bids
  set status='outbid'
  where listing_id=v_listing.id and status='leading';

  insert into public.exchange_bids(
    listing_id,bidder_customer_id,bidder_profile_id,amount,status
  ) values (
    v_listing.id,p_buyer_customer_id,auth.uid(),p_amount,'leading'
  )
  returning * into v_bid;

  update public.exchange_listings
  set current_bid=p_amount,
      bid_count=bid_count+1,
      highest_bid_id=v_bid.id
  where id=v_listing.id;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type,metadata)
  values(v_listing.id,auth.uid(),p_buyer_customer_id,'bid_placed',
    jsonb_build_object('bid_id',v_bid.id,'amount',p_amount));

  return v_bid;
end;
$function$;

create or replace function public.exchange_request_contact(
  p_listing_id uuid,
  p_buyer_customer_id uuid,
  p_request_type text default 'managed_callback',
  p_message text default null
)
returns public.exchange_contact_requests
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_request public.exchange_contact_requests%rowtype;
begin
  if auth.uid() is null or not public.can_access_customer(p_buyer_customer_id) then
    raise exception 'Buyer account is not available to the signed-in user.' using errcode='42501';
  end if;
  if p_request_type not in ('managed_callback','inspection_visit','ask_question') then
    raise exception 'Invalid contact request type.';
  end if;

  select * into v_listing from public.exchange_listings where id=p_listing_id;
  if not found or v_listing.status not in ('live','deal_in_progress') then
    raise exception 'Listing is not available.';
  end if;
  if public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'You cannot request contact on your own listing.' using errcode='42501';
  end if;

  insert into public.exchange_contact_requests(
    listing_id,buyer_customer_id,buyer_profile_id,request_type,message
  ) values (
    p_listing_id,p_buyer_customer_id,auth.uid(),p_request_type,nullif(btrim(p_message),'')
  )
  on conflict (listing_id,buyer_customer_id,request_type)
  where status in ('pending','seller_accepted','connected')
  do update set message=excluded.message, updated_at=now()
  returning * into v_request;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type,metadata)
  values(p_listing_id,auth.uid(),p_buyer_customer_id,'contact_requested',
    jsonb_build_object('request_id',v_request.id,'request_type',p_request_type));

  return v_request;
end;
$function$;

create or replace function public.exchange_respond_contact_request(
  p_request_id uuid,
  p_accept boolean
)
returns public.exchange_contact_requests
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_request public.exchange_contact_requests%rowtype;
  v_listing public.exchange_listings%rowtype;
begin
  select * into v_request
  from public.exchange_contact_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Contact request not found.'; end if;

  select * into v_listing from public.exchange_listings where id=v_request.listing_id;
  if auth.uid() is null or not public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'Only the seller can respond.' using errcode='42501';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This contact request has already been handled.';
  end if;

  update public.exchange_contact_requests
  set status=case when p_accept then 'seller_accepted' else 'seller_declined' end,
      seller_responded_at=now()
  where id=p_request_id
  returning * into v_request;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type,metadata)
  values(v_listing.id,auth.uid(),v_listing.seller_customer_id,
    case when p_accept then 'contact_seller_accepted' else 'contact_seller_declined' end,
    jsonb_build_object('request_id',p_request_id));

  return v_request;
end;
$function$;

create or replace function public.exchange_staff_resolve_contact_request(
  p_request_id uuid,
  p_connected boolean,
  p_notes text default null
)
returns public.exchange_contact_requests
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_request public.exchange_contact_requests%rowtype;
begin
  if auth.uid() is null or not public.exchange_is_staff() then
    raise exception 'Exchange staff access required.' using errcode='42501';
  end if;

  update public.exchange_contact_requests
  set status=case when p_connected then 'connected' else 'closed' end,
      resolved_by=auth.uid(),
      resolved_at=now(),
      resolution_notes=nullif(btrim(p_notes),'')
  where id=p_request_id and status in ('pending','seller_accepted')
  returning * into v_request;

  if not found then raise exception 'Open contact request not found.'; end if;

  insert into public.exchange_events(listing_id,actor_profile_id,event_type,metadata)
  values(v_request.listing_id,auth.uid(),'contact_resolved',
    jsonb_build_object('request_id',v_request.id,'connected',p_connected));

  return v_request;
end;
$function$;

create or replace function public.exchange_accept_leading_bid(p_listing_id uuid)
returns public.exchange_deals
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_bid public.exchange_bids%rowtype;
  v_deal public.exchange_deals%rowtype;
begin
  select * into v_listing
  from public.exchange_listings
  where id=p_listing_id
  for update;

  if not found then raise exception 'Listing not found.'; end if;
  if auth.uid() is null or not public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'Only the seller can accept a bid.' using errcode='42501';
  end if;
  if v_listing.status <> 'live' then
    raise exception 'This listing is not accepting a deal.';
  end if;

  select * into v_bid
  from public.exchange_bids
  where listing_id=v_listing.id and status='leading'
  order by amount desc, placed_at asc
  limit 1
  for update;

  if not found then raise exception 'There is no active bid to accept.'; end if;

  update public.exchange_bids
  set status=case when id=v_bid.id then 'accepted' else 'rejected' end
  where listing_id=v_listing.id and status in ('leading','outbid');

  insert into public.exchange_deals(
    listing_id,accepted_bid_id,seller_customer_id,buyer_customer_id,agreed_price
  ) values (
    v_listing.id,v_bid.id,v_listing.seller_customer_id,v_bid.bidder_customer_id,v_bid.amount
  )
  returning * into v_deal;

  update public.exchange_listings
  set status='deal_in_progress'
  where id=v_listing.id;

  insert into public.exchange_events(listing_id,deal_id,actor_profile_id,actor_customer_id,event_type,metadata)
  values(v_listing.id,v_deal.id,auth.uid(),v_listing.seller_customer_id,'bid_accepted',
    jsonb_build_object('bid_id',v_bid.id,'amount',v_bid.amount));

  return v_deal;
end;
$function$;

create or replace function public.exchange_confirm_deal(p_deal_id uuid)
returns public.exchange_deals
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_deal public.exchange_deals%rowtype;
begin
  select * into v_deal
  from public.exchange_deals
  where id=p_deal_id
  for update;

  if not found then raise exception 'Deal not found.'; end if;
  if auth.uid() is null or not public.can_access_customer(v_deal.buyer_customer_id) then
    raise exception 'Only the buyer can confirm this deal.' using errcode='42501';
  end if;
  if v_deal.status <> 'seller_accepted' then
    raise exception 'This deal cannot be confirmed now.';
  end if;

  update public.exchange_deals
  set status='buyer_confirmed', buyer_confirmed_at=now()
  where id=p_deal_id
  returning * into v_deal;

  insert into public.exchange_events(listing_id,deal_id,actor_profile_id,actor_customer_id,event_type)
  values(v_deal.listing_id,v_deal.id,auth.uid(),v_deal.buyer_customer_id,'deal_buyer_confirmed');

  return v_deal;
end;
$function$;

create or replace function public.exchange_staff_update_deal(
  p_deal_id uuid,
  p_status text,
  p_notes text default null
)
returns public.exchange_deals
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_deal public.exchange_deals%rowtype;
begin
  if auth.uid() is null or not public.exchange_is_staff() then
    raise exception 'Exchange staff access required.' using errcode='42501';
  end if;
  if p_status not in (
    'inspection_pending','inspection_complete','payment_pending','handover_pending',
    'rc_transfer_pending','completed','cancelled','disputed'
  ) then
    raise exception 'Invalid deal status.';
  end if;

  update public.exchange_deals
  set status=p_status,
      staff_notes=coalesce(nullif(btrim(p_notes),''),staff_notes),
      inspection_completed_at=case when p_status='inspection_complete' then now() else inspection_completed_at end,
      payment_confirmed_at=case when p_status='handover_pending' then now() else payment_confirmed_at end,
      handover_completed_at=case when p_status='rc_transfer_pending' then now() else handover_completed_at end,
      rc_transfer_completed_at=case when p_status='completed' then now() else rc_transfer_completed_at end,
      completed_at=case when p_status='completed' then now() else completed_at end,
      cancelled_at=case when p_status='cancelled' then now() else cancelled_at end,
      cancellation_reason=case when p_status='cancelled' then nullif(btrim(p_notes),'') else cancellation_reason end
  where id=p_deal_id
  returning * into v_deal;

  if not found then raise exception 'Deal not found.'; end if;

  if p_status='completed' then
    update public.exchange_listings
    set status='sold', sold_at=now()
    where id=v_deal.listing_id;
  elsif p_status='cancelled' then
    update public.exchange_listings
    set status='paused'
    where id=v_deal.listing_id and status='deal_in_progress';
  end if;

  insert into public.exchange_events(listing_id,deal_id,actor_profile_id,event_type,metadata)
  values(v_deal.listing_id,v_deal.id,auth.uid(),'deal_status_changed',
    jsonb_build_object('status',p_status,'notes',p_notes));

  return v_deal;
end;
$function$;

create or replace function public.exchange_my_activity(p_customer_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','auth'
as $function$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.can_access_customer(p_customer_id) then
    raise exception 'Customer account is not available to the signed-in user.' using errcode='42501';
  end if;

  select jsonb_build_object(
    'favorites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'listing_id',l.id,'listing_no',l.listing_no,'title',l.title,'category',l.category,
        'asking_price',l.asking_price,'current_bid',l.current_bid,'bid_count',l.bid_count,
        'auction_ends_at',l.auction_ends_at,'city',l.city,'state',l.state,
        'year',v.year,'odometer_km',l.odometer_km,'make',v.make,'model',v.model
      ) order by f.created_at desc)
      from public.exchange_favorites f
      join public.exchange_listings l on l.id=f.listing_id
      join public.vehicles v on v.id=l.vehicle_id
      where f.customer_id=p_customer_id and l.status in ('live','deal_in_progress')
    ), '[]'::jsonb),
    'bids', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bid_id',b.id,'listing_id',l.id,'listing_no',l.listing_no,'title',l.title,
        'amount',b.amount,'status',b.status,'placed_at',b.placed_at,
        'current_bid',l.current_bid,'auction_ends_at',l.auction_ends_at,'city',l.city,'state',l.state
      ) order by b.placed_at desc)
      from public.exchange_bids b
      join public.exchange_listings l on l.id=b.listing_id
      where b.bidder_customer_id=p_customer_id
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'listing_id',l.id,'listing_no',l.listing_no,'title',l.title,'category',l.category,
        'status',l.status,'asking_price',l.asking_price,'current_bid',l.current_bid,
        'bid_count',l.bid_count,'auction_ends_at',l.auction_ends_at,'review_notes',l.review_notes,
        'vehicle_id',l.vehicle_id,'year',v.year,'make',v.make,'model',v.model,
        'masked_registration',public.exchange_mask_registration(v.vehicle_no)
      ) order by l.created_at desc)
      from public.exchange_listings l
      join public.vehicles v on v.id=l.vehicle_id
      where l.seller_customer_id=p_customer_id
    ), '[]'::jsonb),
    'deals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'deal_id',d.id,'deal_no',d.deal_no,'listing_id',d.listing_id,'title',l.title,
        'agreed_price',d.agreed_price,'status',d.status,'created_at',d.created_at,
        'side',case when d.buyer_customer_id=p_customer_id then 'buying' else 'selling' end
      ) order by d.created_at desc)
      from public.exchange_deals d
      join public.exchange_listings l on l.id=d.listing_id
      where d.buyer_customer_id=p_customer_id or d.seller_customer_id=p_customer_id
    ), '[]'::jsonb),
    'contact_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'request_id',r.id,'listing_id',r.listing_id,'title',l.title,'request_type',r.request_type,
        'status',r.status,'created_at',r.created_at,
        'side',case when r.buyer_customer_id=p_customer_id then 'buyer' else 'seller' end
      ) order by r.created_at desc)
      from public.exchange_contact_requests r
      join public.exchange_listings l on l.id=r.listing_id
      where r.buyer_customer_id=p_customer_id or l.seller_customer_id=p_customer_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$function$;

create or replace function public.exchange_seller_bid_book(p_listing_id uuid)
returns table (
  bid_id uuid,
  bidder_alias text,
  amount numeric,
  status text,
  placed_at timestamptz
)
language plpgsql
stable security definer
set search_path to 'public','auth'
as $function$
declare
  v_seller uuid;
begin
  select seller_customer_id into v_seller
  from public.exchange_listings
  where id=p_listing_id;

  if v_seller is null then raise exception 'Listing not found.'; end if;
  if auth.uid() is null or not public.can_access_customer(v_seller) then
    raise exception 'Only the seller can view this bid book.' using errcode='42501';
  end if;

  return query
  select
    b.id,
    'Buyer •••' || upper(right(replace(b.bidder_customer_id::text,'-',''),4)),
    b.amount,
    b.status,
    b.placed_at
  from public.exchange_bids b
  where b.listing_id=p_listing_id
  order by b.amount desc, b.placed_at asc;
end;
$function$;

create or replace function public.exchange_withdraw_listing(p_listing_id uuid)
returns public.exchange_listings
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
begin
  select * into v_listing from public.exchange_listings where id=p_listing_id for update;
  if not found then raise exception 'Listing not found.'; end if;
  if auth.uid() is null or not public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'Only the seller can withdraw this listing.' using errcode='42501';
  end if;
  if v_listing.status in ('deal_in_progress','sold') then
    raise exception 'This listing cannot be withdrawn while a deal is in progress or completed.';
  end if;

  update public.exchange_listings
  set status='withdrawn', withdrawn_at=now()
  where id=p_listing_id
  returning * into v_listing;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type)
  values(v_listing.id,auth.uid(),v_listing.seller_customer_id,'listing_withdrawn');

  return v_listing;
end;
$function$;

-- Marketplace media bucket remains private. The app can upload only under
-- <listing_uuid>/<object>, and authenticated reads are allowed only for live
-- listings or the owning seller.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'exchange-media','exchange-media',false,15728640,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime']::text[]
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "exchange media seller upload" on storage.objects;
create policy "exchange media seller upload"
on storage.objects for insert to authenticated
with check (
  bucket_id='exchange-media'
  and exists (
    select 1
    from public.exchange_listings l
    where l.id::text = (storage.foldername(name))[1]
      and public.can_access_customer(l.seller_customer_id)
      and l.status in ('draft','rejected','paused','pending_review')
  )
);

drop policy if exists "exchange media seller update" on storage.objects;
create policy "exchange media seller update"
on storage.objects for update to authenticated
using (
  bucket_id='exchange-media'
  and exists (
    select 1
    from public.exchange_listings l
    where l.id::text = (storage.foldername(name))[1]
      and public.can_access_customer(l.seller_customer_id)
      and l.status in ('draft','rejected','paused','pending_review')
  )
)
with check (
  bucket_id='exchange-media'
  and exists (
    select 1
    from public.exchange_listings l
    where l.id::text = (storage.foldername(name))[1]
      and public.can_access_customer(l.seller_customer_id)
      and l.status in ('draft','rejected','paused','pending_review')
  )
);

drop policy if exists "exchange media seller delete" on storage.objects;
create policy "exchange media seller delete"
on storage.objects for delete to authenticated
using (
  bucket_id='exchange-media'
  and exists (
    select 1
    from public.exchange_listings l
    where l.id::text = (storage.foldername(name))[1]
      and public.can_access_customer(l.seller_customer_id)
      and l.status in ('draft','rejected','paused','pending_review')
  )
);

drop policy if exists "exchange media authenticated read" on storage.objects;
create policy "exchange media authenticated read"
on storage.objects for select to authenticated
using (
  bucket_id='exchange-media'
  and exists (
    select 1
    from public.exchange_listings l
    where l.id::text = (storage.foldername(name))[1]
      and (
        l.status in ('live','deal_in_progress','sold')
        or public.can_access_customer(l.seller_customer_id)
        or public.exchange_is_staff()
      )
  )
);

create or replace function public.exchange_register_listing_media(
  p_listing_id uuid,
  p_storage_path text,
  p_media_type text default 'photo',
  p_label text default null,
  p_mime_type text default null,
  p_file_size bigint default null,
  p_sort_order integer default 0,
  p_is_cover boolean default false
)
returns public.exchange_listing_media
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_media public.exchange_listing_media%rowtype;
begin
  select * into v_listing from public.exchange_listings where id=p_listing_id;
  if not found then raise exception 'Listing not found.'; end if;
  if auth.uid() is null or not public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'Only the seller can add listing media.' using errcode='42501';
  end if;
  if p_media_type not in ('photo','video') then raise exception 'Invalid media type.'; end if;
  if p_storage_path is null or p_storage_path not like p_listing_id::text || '/%' then
    raise exception 'Media path must be inside the listing folder.';
  end if;

  if p_is_cover then
    update public.exchange_listing_media set is_cover=false where listing_id=p_listing_id;
  end if;

  insert into public.exchange_listing_media(
    listing_id,media_type,label,storage_path,mime_type,file_size,sort_order,is_cover,uploaded_by
  ) values (
    p_listing_id,p_media_type,nullif(btrim(p_label),''),p_storage_path,p_mime_type,p_file_size,
    coalesce(p_sort_order,0),coalesce(p_is_cover,false),auth.uid()
  )
  returning * into v_media;

  return v_media;
end;
$function$;

revoke all on function public.exchange_is_staff() from public;
revoke all on function public.exchange_marketplace_feed(text,text,integer,integer) from public;
revoke all on function public.exchange_my_sellable_vehicles(uuid) from public;
revoke all on function public.exchange_upsert_listing_draft(uuid,uuid,uuid,text,text,bigint,numeric,numeric,numeric,integer,integer,text,text,jsonb,jsonb) from public;
revoke all on function public.exchange_submit_listing(uuid) from public;
revoke all on function public.exchange_review_listing(uuid,boolean,text,timestamptz,boolean,integer) from public;
revoke all on function public.exchange_toggle_favorite(uuid,uuid) from public;
revoke all on function public.exchange_place_bid(uuid,uuid,numeric) from public;
revoke all on function public.exchange_request_contact(uuid,uuid,text,text) from public;
revoke all on function public.exchange_respond_contact_request(uuid,boolean) from public;
revoke all on function public.exchange_staff_resolve_contact_request(uuid,boolean,text) from public;
revoke all on function public.exchange_accept_leading_bid(uuid) from public;
revoke all on function public.exchange_confirm_deal(uuid) from public;
revoke all on function public.exchange_staff_update_deal(uuid,text,text) from public;
revoke all on function public.exchange_my_activity(uuid) from public;
revoke all on function public.exchange_seller_bid_book(uuid) from public;
revoke all on function public.exchange_withdraw_listing(uuid) from public;
revoke all on function public.exchange_register_listing_media(uuid,text,text,text,text,bigint,integer,boolean) from public;

grant execute on function public.exchange_is_staff() to authenticated;
grant execute on function public.exchange_marketplace_feed(text,text,integer,integer) to authenticated;
grant execute on function public.exchange_my_sellable_vehicles(uuid) to authenticated;
grant execute on function public.exchange_upsert_listing_draft(uuid,uuid,uuid,text,text,bigint,numeric,numeric,numeric,integer,integer,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.exchange_submit_listing(uuid) to authenticated;
grant execute on function public.exchange_review_listing(uuid,boolean,text,timestamptz,boolean,integer) to authenticated;
grant execute on function public.exchange_toggle_favorite(uuid,uuid) to authenticated;
grant execute on function public.exchange_place_bid(uuid,uuid,numeric) to authenticated;
grant execute on function public.exchange_request_contact(uuid,uuid,text,text) to authenticated;
grant execute on function public.exchange_respond_contact_request(uuid,boolean) to authenticated;
grant execute on function public.exchange_staff_resolve_contact_request(uuid,boolean,text) to authenticated;
grant execute on function public.exchange_accept_leading_bid(uuid) to authenticated;
grant execute on function public.exchange_confirm_deal(uuid) to authenticated;
grant execute on function public.exchange_staff_update_deal(uuid,text,text) to authenticated;
grant execute on function public.exchange_my_activity(uuid) to authenticated;
grant execute on function public.exchange_seller_bid_book(uuid) to authenticated;
grant execute on function public.exchange_withdraw_listing(uuid) to authenticated;
grant execute on function public.exchange_register_listing_media(uuid,text,text,text,text,bigint,integer,boolean) to authenticated;
