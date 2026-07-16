-- Align Group-created Corporate applications with the website approval contract.
-- The Corporate Creator is the authenticated Group user, while Dedicated SPOC remains a separate login.

create or replace function public.align_group_corporate_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft jsonb := coalesce(new.draft_data, '{}'::jsonb);
  v_creator_name text;
  v_creator_phone text;
  v_creator_email text;
  v_location_id uuid;
  v_postal_code text;
begin
  if new.partner_type <> 'corporate' or new.group_customer_id is null then
    return new;
  end if;

  v_creator_name := nullif(btrim(v_draft->>'corporate_creator_name'), '');
  v_creator_phone := regexp_replace(coalesce(v_draft->>'corporate_creator_mobile', ''), '\D', '', 'g');
  v_creator_email := nullif(lower(btrim(v_draft->>'corporate_creator_email')), '');
  v_postal_code := nullif(btrim(v_draft->>'postal_code'), '');

  if length(v_creator_phone) = 10 then
    v_creator_phone := '+91' || v_creator_phone;
  elsif length(v_creator_phone) = 12 and left(v_creator_phone, 2) = '91' then
    v_creator_phone := '+' || v_creator_phone;
  end if;

  if nullif(v_draft->>'india_location_id', '') is null and v_postal_code is not null then
    select location.id
      into v_location_id
    from public.india_locations location
    where location.pincode = v_postal_code
    order by
      case when lower(location.city_name) = lower(coalesce(v_draft->>'city', '')) then 0 else 1 end,
      case when lower(location.state_name) = lower(coalesce(v_draft->>'state', '')) then 0 else 1 end,
      location.city_name
    limit 1;

    if v_location_id is not null then
      v_draft := jsonb_set(v_draft, '{india_location_id}', to_jsonb(v_location_id::text), true);
    end if;
  end if;

  if v_creator_name is not null then
    v_draft := jsonb_set(v_draft, '{contact_name}', to_jsonb(v_creator_name), true);
  end if;
  if v_creator_phone ~ '^\+91[0-9]{10}$' then
    v_draft := jsonb_set(v_draft, '{phone}', to_jsonb(v_creator_phone), true);
    new.applicant_phone := v_creator_phone;
  end if;
  if v_creator_email is not null then
    v_draft := jsonb_set(v_draft, '{email}', to_jsonb(v_creator_email), true);
    new.applicant_email := v_creator_email;
  end if;

  v_draft := jsonb_set(v_draft, '{login_contact_count}', '4'::jsonb, true);
  new.draft_data := v_draft;
  return new;
end;
$$;

-- Replace earlier normalization triggers with one authoritative Corporate alignment trigger.
drop trigger if exists trg_normalize_group_corporate_onboarding on public.customer_onboarding_applications;
drop trigger if exists trg_align_group_corporate_contacts on public.customer_onboarding_applications;
drop trigger if exists trg_sync_group_corporate_contacts on public.customer_onboarding_applications;
drop trigger if exists trg_align_group_corporate_application on public.customer_onboarding_applications;

create trigger trg_align_group_corporate_application
before insert or update of draft_data, partner_type, group_customer_id, applicant_phone, applicant_email
on public.customer_onboarding_applications
for each row
execute function public.align_group_corporate_application();

create or replace function public.sync_group_corporate_onboarding_contacts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft jsonb := coalesce(new.draft_data, '{}'::jsonb);
  v_role text;
  v_name text;
  v_phone text;
  v_email text;
begin
  if new.partner_type <> 'corporate' or new.group_customer_id is null then
    return new;
  end if;

  foreach v_role in array array['corporate_creator','ceo_head','admin_head','dedicated_spoc'] loop
    v_name := nullif(btrim(v_draft->>(v_role || '_name')), '');
    v_phone := regexp_replace(coalesce(v_draft->>(v_role || '_mobile'), ''), '\D', '', 'g');
    v_email := nullif(lower(btrim(v_draft->>(v_role || '_email'))), '');

    if length(v_phone) = 10 then
      v_phone := '+91' || v_phone;
    elsif length(v_phone) = 12 and left(v_phone, 2) = '91' then
      v_phone := '+' || v_phone;
    end if;

    if v_name is not null and v_phone ~ '^\+91[0-9]{10}$' then
      insert into public.customer_onboarding_contacts (
        application_id, contact_role, full_name, phone, email, login_required, updated_at
      ) values (
        new.id, v_role, v_name, v_phone, v_email, true, now()
      )
      on conflict (application_id, contact_role)
      do update set
        full_name = excluded.full_name,
        phone = excluded.phone,
        email = excluded.email,
        login_required = true,
        updated_at = now();
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_sync_group_corporate_onboarding_contacts on public.customer_onboarding_applications;
create trigger trg_sync_group_corporate_onboarding_contacts
after insert or update of draft_data, partner_type, group_customer_id
on public.customer_onboarding_applications
for each row
execute function public.sync_group_corporate_onboarding_contacts();

-- Backfill existing Group-created Corporate applications, including the currently submitted record.
update public.customer_onboarding_applications
set draft_data = coalesce(draft_data, '{}'::jsonb),
    updated_at = now()
where partner_type = 'corporate'
  and group_customer_id is not null
  and status in ('in_progress', 'submitted', 'under_review', 'changes_requested');
