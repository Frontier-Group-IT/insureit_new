-- Fix Customer Exchange media Storage policy evaluation without granting
-- direct SELECT access to exchange_listings.
--
-- Storage RLS policies run in the authenticated request context. Direct
-- subqueries against public.exchange_listings therefore fail because the table
-- intentionally has no authenticated SELECT grant. Keep that protection and
-- expose only narrowly-scoped SECURITY DEFINER boolean checks for media access.

create or replace function public.exchange_can_write_listing_media(p_listing_id_text text)
returns boolean
language sql
stable
security definer
set search_path to 'public','auth'
as $function$
  select exists (
    select 1
    from public.exchange_listings l
    where l.id::text = p_listing_id_text
      and public.can_access_customer(l.seller_customer_id)
      and l.status in ('draft','rejected','paused','pending_review')
  );
$function$;

create or replace function public.exchange_can_read_listing_media(p_listing_id_text text)
returns boolean
language sql
stable
security definer
set search_path to 'public','auth'
as $function$
  select exists (
    select 1
    from public.exchange_listings l
    where l.id::text = p_listing_id_text
      and (
        l.status in ('live','deal_in_progress','sold')
        or public.can_access_customer(l.seller_customer_id)
        or public.exchange_is_staff()
      )
  );
$function$;

revoke all on function public.exchange_can_write_listing_media(text) from public;
revoke all on function public.exchange_can_read_listing_media(text) from public;
grant execute on function public.exchange_can_write_listing_media(text) to authenticated;
grant execute on function public.exchange_can_read_listing_media(text) to authenticated;

drop policy if exists "exchange media seller upload" on storage.objects;
create policy "exchange media seller upload"
on storage.objects for insert to authenticated
with check (
  bucket_id='exchange-media'
  and public.exchange_can_write_listing_media((storage.foldername(name))[1])
);

drop policy if exists "exchange media seller update" on storage.objects;
create policy "exchange media seller update"
on storage.objects for update to authenticated
using (
  bucket_id='exchange-media'
  and public.exchange_can_write_listing_media((storage.foldername(name))[1])
)
with check (
  bucket_id='exchange-media'
  and public.exchange_can_write_listing_media((storage.foldername(name))[1])
);

drop policy if exists "exchange media seller delete" on storage.objects;
create policy "exchange media seller delete"
on storage.objects for delete to authenticated
using (
  bucket_id='exchange-media'
  and public.exchange_can_write_listing_media((storage.foldername(name))[1])
);

drop policy if exists "exchange media authenticated read" on storage.objects;
create policy "exchange media authenticated read"
on storage.objects for select to authenticated
using (
  bucket_id='exchange-media'
  and public.exchange_can_read_listing_media((storage.foldername(name))[1])
);
