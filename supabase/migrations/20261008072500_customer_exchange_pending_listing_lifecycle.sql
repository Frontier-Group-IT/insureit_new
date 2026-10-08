-- Repair Customer Exchange pending-listing lifecycle.
-- 1) Seller-owned pending/rejected/paused listings remain viewable through the
--    existing detail RPC without exposing them in the public marketplace feed.
-- 2) Submission now requires all six guided photos and a cover image.

create or replace function public.exchange_listing_detail(p_listing_id uuid)
returns jsonb
language plpgsql
stable
security definer
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

  if v_listing.status not in ('live','deal_in_progress','sold')
     and not public.can_access_customer(v_listing.seller_customer_id)
     and not public.exchange_is_staff() then
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
    select source, end_date, insurer_name
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
    'status', v_listing.status,
    'title', v_listing.title,
    'category', v_listing.category,
    'selling_mode', v_listing.selling_mode,
    'year', v_vehicle.year,
    'odometer_km', v_listing.odometer_km,
    'city', v_listing.city,
    'state', v_listing.state,
    'asking_price', v_listing.asking_price,
    'current_bid', v_listing.current_bid,
    'bid_count', v_listing.bid_count,
    'min_bid_increment', v_listing.min_bid_increment,
    'auction_ends_at', v_listing.auction_ends_at,
    'owner_verified', v_listing.owner_verification_status = 'verified',
    'documents_verified', v_listing.document_verification_status = 'verified',
    'inspected', v_listing.inspection_status = 'completed',
    'inspection_score', v_listing.inspection_score,
    'masked_registration', public.exchange_mask_registration(v_vehicle.vehicle_no),
    'fuel_type', v_vehicle.fuel_type,
    'ownership_count', v_listing.ownership_count,
    'tyre_condition_percent', v_listing.tyre_condition_percent,
    'permit_summary', v_listing.permit_summary,
    'finance_summary', v_listing.finance_summary,
    'make', v_vehicle.make,
    'model', v_vehicle.model,
    'vehicle_type', v_vehicle.vehicle_type,
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

create or replace function public.exchange_submit_listing(p_listing_id uuid)
returns public.exchange_listings
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_listing public.exchange_listings%rowtype;
  v_photo_count integer;
  v_cover_count integer;
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

  select
    count(*) filter (where media_type='photo'),
    count(*) filter (where media_type='photo' and is_cover)
  into v_photo_count, v_cover_count
  from public.exchange_listing_media
  where listing_id = p_listing_id;

  if coalesce(v_photo_count,0) < 6 then
    raise exception 'Add all 6 guided vehicle photos before submitting the listing.';
  end if;
  if coalesce(v_cover_count,0) < 1 then
    raise exception 'A cover photo is required before submitting the listing.';
  end if;

  update public.exchange_listings
  set status='pending_review', submitted_at=now(), review_notes=null
  where id=p_listing_id
  returning * into v_listing;

  insert into public.exchange_events(listing_id,actor_profile_id,actor_customer_id,event_type)
  values(v_listing.id,auth.uid(),v_listing.seller_customer_id,'listing_submitted');

  return v_listing;
end;
$function$;

revoke all on function public.exchange_listing_detail(uuid) from public;
revoke all on function public.exchange_submit_listing(uuid) from public;
grant execute on function public.exchange_listing_detail(uuid) to authenticated;
grant execute on function public.exchange_submit_listing(uuid) to authenticated;
