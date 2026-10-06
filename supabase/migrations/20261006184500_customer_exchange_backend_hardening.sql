-- Harden Customer Exchange listing ownership and draft idempotency.

drop index if exists public.exchange_one_active_listing_per_vehicle_idx;
create unique index exchange_one_active_listing_per_vehicle_idx
  on public.exchange_listings(vehicle_id)
  where status in ('draft','pending_review','live','paused','deal_in_progress');

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

  -- A vehicle gets one editable Exchange listing at a time. This makes draft
  -- saving idempotent across app restarts and prevents duplicate drafts.
  if p_listing_id is null then
    select * into v_listing
    from public.exchange_listings l
    where l.vehicle_id = p_vehicle_id
      and l.seller_customer_id = p_customer_id
      and l.status in ('draft','rejected','paused')
    order by l.updated_at desc, l.created_at desc
    limit 1
    for update;

    if found then
      p_listing_id := v_listing.id;
    end if;
  end if;

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
    if v_listing.id is null then
      select * into v_listing
      from public.exchange_listings l
      where l.id = p_listing_id
      for update;
    end if;

    if not found and v_listing.id is null then
      raise exception 'Listing not found.';
    end if;
    if v_listing.seller_customer_id is distinct from p_customer_id then
      raise exception 'Listing and vehicle owner must belong to the same customer account.' using errcode='42501';
    end if;
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

revoke all on function public.exchange_upsert_listing_draft(uuid,uuid,uuid,text,text,bigint,numeric,numeric,numeric,integer,integer,text,text,jsonb,jsonb) from public;
grant execute on function public.exchange_upsert_listing_draft(uuid,uuid,uuid,text,text,bigint,numeric,numeric,numeric,integer,integer,text,text,jsonb,jsonb) to authenticated;
