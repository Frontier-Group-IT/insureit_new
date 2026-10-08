-- Add governed Operations review authority for Customer Exchange listings.
-- Only Super Admin, IT Super User, Sales Head and Operations Head may approve
-- or reject submitted listings. Existing broader Exchange staff helpers remain
-- unchanged for non-review internal access.

create or replace function public.exchange_can_review_listing()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(public.current_app_role()::text in (
    'super_admin',
    'it_super_user',
    'sales_head',
    'sales_operations_head'
  ), false);
$function$;

revoke all on function public.exchange_can_review_listing() from public;
grant execute on function public.exchange_can_review_listing() to authenticated;

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
  v_photo_count integer;
  v_cover_count integer;
begin
  if auth.uid() is null or not public.exchange_can_review_listing() then
    raise exception 'Exchange listing review access required.' using errcode='42501';
  end if;

  select * into v_listing
  from public.exchange_listings
  where id=p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found.';
  end if;

  if v_listing.status <> 'pending_review' then
    raise exception 'Only pending listings can be reviewed.';
  end if;

  if p_approve then
    select
      count(*) filter (where media_type='photo'),
      count(*) filter (where media_type='photo' and is_cover)
    into v_photo_count, v_cover_count
    from public.exchange_listing_media
    where listing_id=p_listing_id;

    if coalesce(v_photo_count,0) < 6 then
      raise exception 'Listing cannot be approved until all 6 guided vehicle photos are uploaded.';
    end if;

    if coalesce(v_cover_count,0) < 1 then
      raise exception 'Listing cannot be approved without a cover photo.';
    end if;
  elsif nullif(btrim(p_notes),'') is null then
    raise exception 'A rejection reason is required.';
  end if;

  update public.exchange_listings
  set status = case when p_approve then 'live' else 'rejected' end,
      review_notes = nullif(btrim(p_notes),''),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      published_at = case when p_approve then now() else published_at end,
      auction_ends_at = case
        when p_approve and selling_mode='managed_auction'
          then coalesce(p_auction_ends_at, now()+interval '7 days')
        else auction_ends_at
      end,
      expires_at = case
        when p_approve then coalesce(
          case when selling_mode='managed_auction' then p_auction_ends_at end,
          now()+interval '30 days'
        )
        else expires_at
      end,
      document_verification_status = case
        when p_document_verified then 'verified'
        else document_verification_status
      end,
      inspection_status = case
        when p_inspection_score is not null then 'completed'
        else inspection_status
      end,
      inspection_score = coalesce(p_inspection_score, inspection_score),
      updated_at = now()
  where id=p_listing_id
  returning * into v_listing;

  insert into public.exchange_events(listing_id,actor_profile_id,event_type,metadata)
  values(
    v_listing.id,
    auth.uid(),
    case when p_approve then 'listing_approved' else 'listing_rejected' end,
    jsonb_build_object('notes',nullif(btrim(p_notes),''),'review_role',public.current_app_role()::text)
  );

  return v_listing;
end;
$function$;

revoke all on function public.exchange_review_listing(uuid,boolean,text,timestamptz,boolean,integer) from public;
grant execute on function public.exchange_review_listing(uuid,boolean,text,timestamptz,boolean,integer) to authenticated;
