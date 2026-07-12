-- Repair duplicate customer rows created during onboarding retries.
-- Keeps the earliest customer row for each normalized mobile number,
-- preserves its identity/name, fills missing onboarding fields from newer rows,
-- re-links dependent records, then prevents future duplicates.

do $$
declare
  group_row record;
  duplicate_row record;
  keeper_id uuid;
  ref_row record;
begin
  for group_row in
    select right(regexp_replace(phone, '\D', '', 'g'), 10) as mobile_key
    from public.customers
    where phone is not null
      and length(regexp_replace(phone, '\D', '', 'g')) >= 10
    group by right(regexp_replace(phone, '\D', '', 'g'), 10)
    having count(*) > 1
  loop
    select id into keeper_id
    from public.customers
    where right(regexp_replace(phone, '\D', '', 'g'), 10) = group_row.mobile_key
    order by created_at asc, id asc
    limit 1;

    for duplicate_row in
      select *
      from public.customers
      where right(regexp_replace(phone, '\D', '', 'g'), 10) = group_row.mobile_key
        and id <> keeper_id
      order by created_at asc
    loop
      update public.customers keeper
      set
        profile_id = coalesce(keeper.profile_id, duplicate_row.profile_id),
        partner_type = coalesce(keeper.partner_type, duplicate_row.partner_type),
        company_name = coalesce(keeper.company_name, duplicate_row.company_name),
        email = coalesce(keeper.email, duplicate_row.email),
        address = coalesce(keeper.address, duplicate_row.address),
        address_street = coalesce(keeper.address_street, duplicate_row.address_street),
        address_locality = coalesce(keeper.address_locality, duplicate_row.address_locality),
        india_location_id = coalesce(keeper.india_location_id, duplicate_row.india_location_id),
        city = coalesce(keeper.city, duplicate_row.city),
        state = coalesce(keeper.state, duplicate_row.state),
        postal_code = coalesce(keeper.postal_code, duplicate_row.postal_code),
        pan_number = coalesce(keeper.pan_number, duplicate_row.pan_number),
        aadhaar_last_four = coalesce(keeper.aadhaar_last_four, duplicate_row.aadhaar_last_four),
        aadhaar_hash = coalesce(keeper.aadhaar_hash, duplicate_row.aadhaar_hash),
        legal_trade_name = coalesce(keeper.legal_trade_name, duplicate_row.legal_trade_name),
        is_gst_registered = coalesce(keeper.is_gst_registered, duplicate_row.is_gst_registered),
        gst_number = coalesce(keeper.gst_number, duplicate_row.gst_number),
        fleet_size_band = coalesce(keeper.fleet_size_band, duplicate_row.fleet_size_band),
        onboarding_status = case
          when keeper.onboarding_status = 'active' or duplicate_row.onboarding_status = 'active' then 'active'
          else coalesce(keeper.onboarding_status, duplicate_row.onboarding_status)
        end,
        onboarding_completed_at = coalesce(keeper.onboarding_completed_at, duplicate_row.onboarding_completed_at),
        updated_at = now()
      where keeper.id = keeper_id;

      for ref_row in
        select
          conrelid::regclass as table_name,
          a.attname as column_name
        from pg_constraint c
        join pg_attribute a
          on a.attrelid = c.conrelid
         and a.attnum = any(c.conkey)
        where c.contype = 'f'
          and c.confrelid = 'public.customers'::regclass
          and array_length(c.conkey, 1) = 1
      loop
        execute format(
          'update %s set %I = $1 where %I = $2',
          ref_row.table_name,
          ref_row.column_name,
          ref_row.column_name
        ) using keeper_id, duplicate_row.id;
      end loop;

      delete from public.customers where id = duplicate_row.id;
    end loop;
  end loop;
end $$;

-- Normalize all stored customer mobile numbers to +91XXXXXXXXXX where possible.
update public.customers
set phone = '+91' || right(regexp_replace(phone, '\D', '', 'g'), 10)
where phone is not null
  and length(regexp_replace(phone, '\D', '', 'g')) >= 10;

create unique index if not exists customers_profile_id_unique_idx
  on public.customers(profile_id)
  where profile_id is not null;

create unique index if not exists customers_mobile_unique_idx
  on public.customers((right(regexp_replace(phone, '\D', '', 'g'), 10)))
  where phone is not null
    and length(regexp_replace(phone, '\D', '', 'g')) >= 10;
