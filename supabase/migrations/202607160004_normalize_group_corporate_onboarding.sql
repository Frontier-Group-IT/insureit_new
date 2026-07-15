create or replace function public.normalize_group_corporate_onboarding_draft()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_location_id uuid;
  v_city text;
  v_state text;
  v_postal_code text;
  v_creator_name text;
  v_creator_mobile text;
  v_creator_email text;
begin
  if new.partner_type <> 'corporate' or new.group_customer_id is null then
    return new;
  end if;

  new.draft_data := coalesce(new.draft_data, '{}'::jsonb);

  v_city := nullif(btrim(new.draft_data->>'city'), '');
  v_state := nullif(btrim(new.draft_data->>'state'), '');
  v_postal_code := nullif(btrim(new.draft_data->>'postal_code'), '');
  v_creator_name := nullif(btrim(new.draft_data->>'corporate_creator_name'), '');
  v_creator_mobile := nullif(btrim(new.draft_data->>'corporate_creator_mobile'), '');
  v_creator_email := nullif(btrim(new.draft_data->>'corporate_creator_email'), '');

  if nullif(new.draft_data->>'india_location_id', '') is null and v_postal_code is not null then
    select il.id
      into v_location_id
    from public.india_locations il
    where il.pincode = v_postal_code
      and (v_city is null or lower(il.city_name) = lower(v_city))
      and (v_state is null or lower(il.state_name) = lower(v_state))
    order by
      case when v_city is not null and lower(il.city_name) = lower(v_city) then 0 else 1 end,
      case when v_state is not null and lower(il.state_name) = lower(v_state) then 0 else 1 end,
      il.city_name
    limit 1;

    if v_location_id is null then
      select il.id
        into v_location_id
      from public.india_locations il
      where il.pincode = v_postal_code
      order by il.city_name
      limit 1;
    end if;

    if v_location_id is not null then
      new.draft_data := jsonb_set(new.draft_data, '{india_location_id}', to_jsonb(v_location_id::text), true);
    end if;
  end if;

  if nullif(new.draft_data->>'contact_name', '') is null and v_creator_name is not null then
    new.draft_data := jsonb_set(new.draft_data, '{contact_name}', to_jsonb(v_creator_name), true);
  end if;

  if nullif(new.draft_data->>'phone', '') is null and v_creator_mobile is not null then
    new.draft_data := jsonb_set(new.draft_data, '{phone}', to_jsonb(v_creator_mobile), true);
  end if;

  if nullif(new.draft_data->>'email', '') is null and v_creator_email is not null then
    new.draft_data := jsonb_set(new.draft_data, '{email}', to_jsonb(v_creator_email), true);
  end if;

  if nullif(new.applicant_phone, '') is null and v_creator_mobile is not null then
    new.applicant_phone := v_creator_mobile;
  end if;

  if nullif(new.applicant_email, '') is null and v_creator_email is not null then
    new.applicant_email := v_creator_email;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_group_corporate_onboarding
  on public.customer_onboarding_applications;

create trigger trg_normalize_group_corporate_onboarding
before insert or update of draft_data, partner_type, group_customer_id
on public.customer_onboarding_applications
for each row
execute function public.normalize_group_corporate_onboarding_draft();

update public.customer_onboarding_applications
set draft_data = draft_data,
    updated_at = now()
where partner_type = 'corporate'
  and group_customer_id is not null
  and status in ('in_progress', 'submitted', 'under_review', 'changes_requested');
