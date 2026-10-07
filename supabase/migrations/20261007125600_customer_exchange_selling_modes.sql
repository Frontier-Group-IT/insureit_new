-- Customer Exchange selling-mode wiring.
-- The underlying exchange_listings.selling_mode column already exists.
-- This migration exposes it through the customer RPC surface while preserving
-- backward compatibility for clients that omit the new optional draft argument.

drop function if exists public.exchange_marketplace_feed(text,text,integer,integer);

create function public.exchange_marketplace_feed(
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
  selling_mode text,
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
    l.selling_mode,
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

drop function if exists public.exchange_upsert_listing_draft(
  uuid,uuid,uuid,text,text,bigint,numeric,numeric,numeric,integer,integer,text,text,jsonb,jsonb
);

create function public.exchange_upsert_listing_draft(
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
  p_seller_declaration jsonb default '{}'::jsonb,
  p_selling_mode text default 'open_bidding'
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
  if coalesce(p_selling_mode,'') not in ('fixed_price','open_bidding','managed_auction') then
    raise exception 'Select a valid selling mode.';
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
      seller_customer_id, seller_profile_id, vehicle_id, title, category, selling_mode, city, state,
      odometer_km, asking_price, opening_bid, min_bid_increment, ownership_count,
      tyre_condition_percent, permit_summary, finance_summary, condition_details,
      seller_declaration
    ) values (
      p_customer_id, auth.uid(), p_vehicle_id,
      coalesce(nullif(btrim(p_title),''), 'Commercial vehicle'),
      p_category, p_selling_mode, v_city, v_state, p_odometer_km, coalesce(p_asking_price,0),
      coalesce(p_opening_bid,0), coalesce(p_min_bid_increment,10000),
      p_ownership_count, p_tyre_condition_percent, nullif(btrim(p_permit_summary),''),
      nullif(btrim(p_finance_summary),''), coalesce(p_condition_details,'{}'::jsonb),
      coalesce(p_seller_declaration,'{}'::jsonb)
    )
    returning * into v_listing;

    insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type,metadata)
    values(
      v_listing.id,auth.uid(),p_customer_id,'listing_draft_created',
      jsonb_build_object('selling_mode',p_selling_mode)
    );
  else
    select * into v_listing
    from public.exchange_listings l
    where l.id = p_listing_id
    for update;

    if not found then raise exception 'Listing not found.'; end if;
    if v_listing.seller_customer_id is distinct from p_customer_id
       or not public.can_access_customer(v_listing.seller_customer_id) then
      raise exception 'You cannot edit this listing.' using errcode='42501';
    end if;
    if v_listing.status not in ('draft','rejected','paused') then
      raise exception 'This listing cannot be edited in its current status.';
    end if;

    update public.exchange_listings
    set vehicle_id = p_vehicle_id,
        title = coalesce(nullif(btrim(p_title),''), title),
        category = p_category,
        selling_mode = p_selling_mode,
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

    insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type,metadata)
    values(
      v_listing.id,auth.uid(),p_customer_id,'listing_draft_updated',
      jsonb_build_object('selling_mode',p_selling_mode)
    );
  end if;

  return v_listing;
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
    raise exception 'This listing is not open for offers.';
  end if;
  if v_listing.selling_mode = 'fixed_price' then
    raise exception 'This fixed-price listing does not accept offers. Request a managed callback instead.';
  end if;
  if v_listing.auction_ends_at is not null and v_listing.auction_ends_at <= now() then
    update public.exchange_listings set status='expired' where id=v_listing.id;
    raise exception 'Offers have closed for this listing.';
  end if;
  if public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'A seller cannot make an offer on their own vehicle.' using errcode='42501';
  end if;

  v_minimum := case
    when v_listing.bid_count > 0 then v_listing.current_bid + v_listing.min_bid_increment
    else greatest(v_listing.opening_bid, v_listing.min_bid_increment)
  end;

  if p_amount is null or p_amount < v_minimum then
    raise exception 'Minimum next offer is %.', v_minimum;
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
  values(
    v_listing.id,auth.uid(),p_buyer_customer_id,
    case when v_listing.selling_mode='managed_auction' then 'bid_placed' else 'offer_placed' end,
    jsonb_build_object('bid_id',v_bid.id,'amount',p_amount,'selling_mode',v_listing.selling_mode)
  );

  return v_bid;
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
        'selling_mode',l.selling_mode,'asking_price',l.asking_price,'current_bid',l.current_bid,'bid_count',l.bid_count,
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
        'selling_mode',l.selling_mode,'amount',b.amount,'status',b.status,'placed_at',b.placed_at,
        'current_bid',l.current_bid,'auction_ends_at',l.auction_ends_at,'city',l.city,'state',l.state
      ) order by b.placed_at desc)
      from public.exchange_bids b
      join public.exchange_listings l on l.id=b.listing_id
      where b.bidder_customer_id=p_customer_id
    ), '[]'::jsonb),
    'listings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'listing_id',l.id,'listing_no',l.listing_no,'title',l.title,'category',l.category,
        'selling_mode',l.selling_mode,'status',l.status,'asking_price',l.asking_price,'current_bid',l.current_bid,
        'bid_count',l.bid_count,'auction_ends_at',l.auction_ends_at,'review_notes',l.review_notes,
        'odometer_km',l.odometer_km,'tyre_condition_percent',l.tyre_condition_percent,
        'condition_details',coalesce(l.condition_details,'{}'::jsonb),
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
        'selling_mode',l.selling_mode,'agreed_price',d.agreed_price,'status',d.status,'created_at',d.created_at,
        'side',case when d.buyer_customer_id=p_customer_id then 'buying' else 'selling' end
      ) order by d.created_at desc)
      from public.exchange_deals d
      join public.exchange_listings l on l.id=d.listing_id
      where d.buyer_customer_id=p_customer_id or d.seller_customer_id=p_customer_id
    ), '[]'::jsonb),
    'contact_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'request_id',r.id,'listing_id',r.listing_id,'title',l.title,'request_type',r.request_type,
        'selling_mode',l.selling_mode,'status',r.status,'created_at',r.created_at,
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

create or replace function public.exchange_listing_detail(p_listing_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_insurance jsonb;
  v_media jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode='42501';
  end if;

  select * into v_listing
  from public.exchange_listings
  where id = p_listing_id;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if v_listing.status not in ('live','deal_in_progress')
     and not public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'Listing is not available.' using errcode='42501';
  end if;

  select * into v_vehicle
  from public.vehicles
  where id = v_listing.vehicle_id;

  if not found then
    raise exception 'Vehicle record is not available.';
  end if;

  select to_jsonb(insurance_row) into v_insurance
  from (
    select
      source,
      end_date,
      insurer_name
    from (
      select
        'internal'::text as source,
        p.end_date,
        ic.name as insurer_name,
        p.updated_at
      from public.policies p
      left join public.insurance_companies ic on ic.id = p.insurance_company_id
      where p.vehicle_id = v_listing.vehicle_id
        and p.end_date is not null

      union all

      select
        'external'::text as source,
        ep.end_date,
        ic.name as insurer_name,
        ep.updated_at
      from public.external_policies ep
      left join public.insurance_companies ic on ic.id = ep.insurance_company_id
      where ep.vehicle_id = v_listing.vehicle_id
        and ep.end_date is not null
    ) policy_rows
    order by end_date desc, updated_at desc
    limit 1
  ) insurance_row;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'media_type', m.media_type,
    'label', m.label,
    'storage_bucket', m.storage_bucket,
    'storage_path', m.storage_path,
    'mime_type', m.mime_type,
    'sort_order', m.sort_order,
    'is_cover', m.is_cover
  ) order by m.is_cover desc, m.sort_order asc, m.created_at asc), '[]'::jsonb)
  into v_media
  from public.exchange_listing_media m
  where m.listing_id = v_listing.id;

  return jsonb_build_object(
    'listing_id', v_listing.id,
    'listing_no', v_listing.listing_no,
    'selling_mode', v_listing.selling_mode,
    'registration_status', v_vehicle.registration_status,
    'registration_status_as_on', v_vehicle.registration_status_as_on,
    'registration_date', v_vehicle.registration_date,
    'fitness_expiry_date', v_vehicle.fitness_expiry_date,
    'puc_expiry_date', v_vehicle.puc_expiry_date,
    'road_tax_expiry_date', v_vehicle.road_tax_expiry_date,
    'permit_type', v_vehicle.permit_type,
    'permit_valid_from', v_vehicle.permit_valid_from,
    'national_permit_expiry_date', v_vehicle.national_permit_expiry_date,
    'local_permit_expiry_date', v_vehicle.local_permit_expiry_date,
    'gvw_kg', v_vehicle.gvw_kg,
    'unladen_weight_kg', v_vehicle.unladen_weight_kg,
    'wheel_base_mm', v_vehicle.wheel_base_mm,
    'body_type', v_vehicle.body_type,
    'engine_capacity_cc', v_vehicle.engine_capacity_cc,
    'emission_norm', v_vehicle.emission_norm,
    'financed', v_vehicle.financed,
    'financer_name', v_vehicle.financer_name,
    'blacklist_status', v_vehicle.blacklist_status,
    'authbridge_verified', v_vehicle.authbridge_verified,
    'authbridge_last_verified_at', v_vehicle.authbridge_last_verified_at,
    'insurance', coalesce(v_insurance, '{}'::jsonb),
    'media', coalesce(v_media, '[]'::jsonb)
  );
end;
$function$;

create or replace function public.exchange_withdraw_offer(p_bid_id uuid)
returns public.exchange_bids
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_bid public.exchange_bids%rowtype;
  v_listing public.exchange_listings%rowtype;
  v_next public.exchange_bids%rowtype;
begin
  select * into v_bid
  from public.exchange_bids
  where id = p_bid_id
  for update;

  if not found then
    raise exception 'Offer not found.';
  end if;

  if auth.uid() is null or not public.can_access_customer(v_bid.bidder_customer_id) then
    raise exception 'Only the buyer can withdraw this offer.' using errcode='42501';
  end if;

  select * into v_listing
  from public.exchange_listings
  where id = v_bid.listing_id
  for update;

  if not found or v_listing.status <> 'live' then
    raise exception 'This listing is not open for offer changes.';
  end if;
  if v_listing.selling_mode <> 'open_bidding' then
    raise exception 'Only private offers can be withdrawn.';
  end if;
  if v_bid.status not in ('leading','outbid') then
    raise exception 'This offer can no longer be withdrawn.';
  end if;

  update public.exchange_bids
  set status = 'withdrawn', updated_at = now()
  where id = v_bid.id
  returning * into v_bid;

  if v_listing.highest_bid_id = v_bid.id then
    select * into v_next
    from public.exchange_bids
    where listing_id = v_listing.id
      and status = 'outbid'
      and id <> v_bid.id
    order by amount desc, placed_at asc
    limit 1
    for update;

    if found then
      update public.exchange_bids
      set status = 'leading', updated_at = now()
      where id = v_next.id;

      update public.exchange_listings
      set highest_bid_id = v_next.id,
          current_bid = v_next.amount
      where id = v_listing.id;
    else
      update public.exchange_listings
      set highest_bid_id = null,
          current_bid = 0
      where id = v_listing.id;
    end if;
  end if;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type,metadata)
  values(
    v_listing.id,auth.uid(),v_bid.bidder_customer_id,'offer_withdrawn',
    jsonb_build_object('bid_id',v_bid.id,'amount',v_bid.amount)
  );

  return v_bid;
end;
$function$;

create or replace function public.exchange_reject_leading_offer(p_listing_id uuid)
returns public.exchange_bids
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_rejected public.exchange_bids%rowtype;
  v_next public.exchange_bids%rowtype;
begin
  select * into v_listing
  from public.exchange_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;
  if auth.uid() is null or not public.can_access_customer(v_listing.seller_customer_id) then
    raise exception 'Only the seller can reject an offer.' using errcode='42501';
  end if;
  if v_listing.status <> 'live' then
    raise exception 'This listing is not open for offer changes.';
  end if;
  if v_listing.selling_mode <> 'open_bidding' then
    raise exception 'Offer rejection is available only for private-offer listings.';
  end if;

  select * into v_rejected
  from public.exchange_bids
  where listing_id = v_listing.id
    and status = 'leading'
  order by amount desc, placed_at asc
  limit 1
  for update;

  if not found then
    raise exception 'There is no active offer to reject.';
  end if;

  update public.exchange_bids
  set status = 'rejected', updated_at = now()
  where id = v_rejected.id
  returning * into v_rejected;

  select * into v_next
  from public.exchange_bids
  where listing_id = v_listing.id
    and status = 'outbid'
  order by amount desc, placed_at asc
  limit 1
  for update;

  if found then
    update public.exchange_bids
    set status = 'leading', updated_at = now()
    where id = v_next.id;

    update public.exchange_listings
    set highest_bid_id = v_next.id,
        current_bid = v_next.amount
    where id = v_listing.id;
  else
    update public.exchange_listings
    set highest_bid_id = null,
        current_bid = 0
    where id = v_listing.id;
  end if;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type,metadata)
  values(
    v_listing.id,auth.uid(),v_listing.seller_customer_id,'offer_rejected',
    jsonb_build_object('bid_id',v_rejected.id,'amount',v_rejected.amount)
  );

  return v_rejected;
end;
$function$;

create or replace function public.exchange_deal_detail(p_deal_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','auth'
as $function$
declare
  v_deal public.exchange_deals%rowtype;
  v_listing public.exchange_listings%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_side text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode='42501';
  end if;

  select * into v_deal
  from public.exchange_deals
  where id = p_deal_id;

  if not found then
    raise exception 'Deal not found.';
  end if;

  if public.can_access_customer(v_deal.buyer_customer_id) then
    v_side := 'buying';
  elsif public.can_access_customer(v_deal.seller_customer_id) then
    v_side := 'selling';
  else
    raise exception 'This deal is not available to the signed-in user.' using errcode='42501';
  end if;

  select * into v_listing
  from public.exchange_listings
  where id = v_deal.listing_id;

  select * into v_vehicle
  from public.vehicles
  where id = v_listing.vehicle_id;

  return jsonb_build_object(
    'deal_id', v_deal.id,
    'deal_no', v_deal.deal_no,
    'listing_id', v_deal.listing_id,
    'listing_no', v_listing.listing_no,
    'title', v_listing.title,
    'selling_mode', v_listing.selling_mode,
    'side', v_side,
    'agreed_price', v_deal.agreed_price,
    'status', v_deal.status,
    'created_at', v_deal.created_at,
    'buyer_confirmed_at', v_deal.buyer_confirmed_at,
    'inspection_completed_at', v_deal.inspection_completed_at,
    'payment_confirmed_at', v_deal.payment_confirmed_at,
    'handover_completed_at', v_deal.handover_completed_at,
    'rc_transfer_completed_at', v_deal.rc_transfer_completed_at,
    'completed_at', v_deal.completed_at,
    'cancelled_at', v_deal.cancelled_at,
    'cancellation_reason', v_deal.cancellation_reason,
    'masked_registration', case when v_vehicle.id is not null then public.exchange_mask_registration(v_vehicle.vehicle_no) else null end,
    'make', v_vehicle.make,
    'model', v_vehicle.model,
    'year', v_vehicle.year
  );
end;
$function$;

revoke all on function public.exchange_marketplace_feed(text,text,integer,integer) from public;
revoke all on function public.exchange_upsert_listing_draft(uuid,uuid,uuid,text,text,bigint,numeric,numeric,numeric,integer,integer,text,text,jsonb,jsonb,text) from public;
revoke all on function public.exchange_place_bid(uuid,uuid,numeric) from public;
revoke all on function public.exchange_my_activity(uuid) from public;
revoke all on function public.exchange_listing_detail(uuid) from public;
revoke all on function public.exchange_deal_detail(uuid) from public;
revoke all on function public.exchange_withdraw_offer(uuid) from public;
revoke all on function public.exchange_reject_leading_offer(uuid) from public;

grant execute on function public.exchange_marketplace_feed(text,text,integer,integer) to authenticated;
grant execute on function public.exchange_upsert_listing_draft(uuid,uuid,uuid,text,text,bigint,numeric,numeric,numeric,integer,integer,text,text,jsonb,jsonb,text) to authenticated;
grant execute on function public.exchange_place_bid(uuid,uuid,numeric) to authenticated;
grant execute on function public.exchange_my_activity(uuid) to authenticated;
grant execute on function public.exchange_listing_detail(uuid) to authenticated;
grant execute on function public.exchange_deal_detail(uuid) to authenticated;
grant execute on function public.exchange_withdraw_offer(uuid) to authenticated;
grant execute on function public.exchange_reject_leading_offer(uuid) to authenticated;
