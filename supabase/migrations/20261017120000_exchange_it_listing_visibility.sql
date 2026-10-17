-- IT Super User visibility gate for approved Exchange listings.
-- This is independent of the review status and leaves existing listings enabled.
alter table public.exchange_listings
  add column if not exists is_enabled boolean not null default true;

-- The customer feed and direct-detail RPCs use SECURITY DEFINER, so applying
-- client-side filters or RLS alone would NOT prevent data exposure.
-- Patch the existing function definitions without altering their signatures,
-- output shape, permissions, or unrelated listing behavior.
do $$
declare
  v_feed text;
  v_detail text;
begin
  select pg_get_functiondef('public.exchange_marketplace_feed(text,text,integer,integer)'::regprocedure)
    into v_feed;
  if v_feed is null or position('where l.status = ''live''' in v_feed) = 0
     or position('and l.is_enabled = true' in v_feed) > 0 then
    raise exception 'Unexpected Exchange feed definition; migration stopped safely';
  end if;
  v_feed := replace(v_feed,
    'where l.status = ''live''',
    'where l.status = ''live'' and l.is_enabled = true');
  execute v_feed;

  select pg_get_functiondef('public.exchange_listing_detail(uuid)'::regprocedure)
    into v_detail;
  if v_detail is null
    or position('if not found then' in v_detail) = 0
    or position('Listing is not available.' in v_detail) = 0 then
    raise exception 'Unexpected Exchange detail definition; migration stopped safely';
  end if;
  -- Suppress disabled listings for all customer users, including direct-link
  -- views; retain internal staff detail access for moderation.
  v_detail := replace(v_detail,
    'if v_listing.status not in (''live'',''deal_in_progress'',''sold'')',
    'if not v_listing.is_enabled and not public.exchange_is_staff() then\n    raise exception ''Listing is not available.'' using errcode=''42501'';\n  end if;\n\n  if v_listing.status not in (''live'',''deal_in_progress'',''sold'')');
  if v_detail = pg_get_functiondef('public.exchange_listing_detail(uuid)'::regprocedure) then
    raise exception 'Exchange detail visibility condition not found';
  end if;
  execute v_detail;
end $$;

create index if not exists exchange_listing_enabled_live_idx
  on public.exchange_listings(published_at desc)
  where status = 'live' and is_enabled = true;
