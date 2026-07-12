-- Merge duplicate customer rows created by onboarding retries and enforce one
-- customer record per profile/mobile login.

do $$
declare
  duplicate_group record;
  winner_id uuid;
  loser_id uuid;
begin
  for duplicate_group in
    select right(regexp_replace(phone, '\D', '', 'g'), 10) as mobile_key
    from public.customers
    where nullif(regexp_replace(phone, '\D', '', 'g'), '') is not null
    group by right(regexp_replace(phone, '\D', '', 'g'), 10)
    having count(*) > 1
  loop
    select id
    into winner_id
    from public.customers
    where right(regexp_replace(phone, '\D', '', 'g'), 10) = duplicate_group.mobile_key
    order by
      ((profile_id is not null)::int * 100) +
      ((partner_type is not null)::int * 50) +
      ((pan_number is not null)::int * 30) +
      ((india_location_id is not null)::int * 20) +
      ((fleet_size_band is not null)::int * 10) +
      ((company_name is not null)::int * 5) desc,
      updated_at desc nulls last,
      created_at asc
    limit 1;

    update public.customers winner
    set
      profile_id = coalesce(winner.profile_id, source.profile_id),
      contact_name = coalesce(nullif(winner.contact_name, ''), source.contact_name),
      company_name = coalesce(winner.company_name, source.company_name),
      partner_type = coalesce(winner.partner_type, source.partner_type),
      email = coalesce(winner.email, source.email),
      address = coalesce(winner.address, source.address),
      address_street = coalesce(winner.address_street, source.address_street),
      address_locality = coalesce(winner.address_locality, source.address_locality),
      india_location_id = coalesce(winner.india_location_id, source.india_location_id),
      city = coalesce(winner.city, source.city),
      state = coalesce(winner.state, source.state),
      postal_code = coalesce(winner.postal_code, source.postal_code),
      pan_number = coalesce(winner.pan_number, source.pan_number),
      aadhaar_last_four = coalesce(winner.aadhaar_last_four, source.aadhaar_last_four),
      aadhaar_hash = coalesce(winner.aadhaar_hash, source.aadhaar_hash),
      legal_trade_name = coalesce(winner.legal_trade_name, source.legal_trade_name),
      is_gst_registered = winner.is_gst_registered or source.is_gst_registered,
      gst_number = coalesce(winner.gst_number, source.gst_number),
      fleet_size_band = coalesce(winner.fleet_size_band, source.fleet_size_band),
      onboarding_status = case
        when winner.onboarding_status = 'active' or source.onboarding_status = 'active' then 'active'
        else coalesce(winner.onboarding_status, source.onboarding_status)
      end,
      onboarding_completed_at = coalesce(winner.onboarding_completed_at, source.onboarding_completed_at),
      updated_at = now()
    from lateral (
      select *
      from public.customers candidate
      where right(regexp_replace(candidate.phone, '\D', '', 'g'), 10) = duplicate_group.mobile_key
        and candidate.id <> winner_id
      order by
        ((candidate.profile_id is not null)::int * 100) +
        ((candidate.partner_type is not null)::int * 50) +
        ((candidate.pan_number is not null)::int * 30) desc,
        candidate.updated_at desc nulls last
      limit 1
    ) source
    where winner.id = winner_id;

    for loser_id in
      select id
      from public.customers
      where right(regexp_replace(phone, '\D', '', 'g'), 10) = duplicate_group.mobile_key
        and id <> winner_id
    loop
      if to_regclass('public.vehicles') is not null then
        update public.vehicles set customer_id = winner_id where customer_id = loser_id;
      end if;
      if to_regclass('public.policies') is not null then
        update public.policies set customer_id = winner_id where customer_id = loser_id;
      end if;
      if to_regclass('public.claims') is not null then
        update public.claims set customer_id = winner_id where customer_id = loser_id;
      end if;
      if to_regclass('public.customer_documents') is not null then
        update public.customer_documents set customer_id = winner_id where customer_id = loser_id;
      end if;
      if to_regclass('public.claim_documents') is not null then
        update public.claim_documents set customer_id = winner_id where customer_id = loser_id;
      end if;
      if to_regclass('public.notifications') is not null then
        update public.notifications set customer_id = winner_id where customer_id = loser_id;
      end if;

      delete from public.customers where id = loser_id;
    end loop;
  end loop;
end
$$;

update public.customers
set phone = '+91' || right(regexp_replace(phone, '\D', '', 'g'), 10)
where length(regexp_replace(phone, '\D', '', 'g')) >= 10;

create unique index if not exists customers_profile_id_uidx
  on public.customers(profile_id)
  where profile_id is not null;

create unique index if not exists customers_phone_normalized_uidx
  on public.customers ((right(regexp_replace(phone, '\D', '', 'g'), 10)));
