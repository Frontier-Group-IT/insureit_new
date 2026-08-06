begin;

-- Keep the intermediary register's activation timestamp aligned with the
-- canonical onboarding application. Partner activation and POSP/MISP IIB
-- registration are separate lifecycle events, so every application updates
-- only its own intermediary row.
create or replace function public.intermediary_activation_timestamp_for_application(
  p_application_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select max(r.activated_at)
      from public.intermediary_registrations r
      where r.application_id = a.id
    ),
    p.iib_uploaded_at,
    case
      when p.onboarding_date is not null then p.onboarding_date::timestamptz
      else null
    end,
    a.completed_at,
    a.reviewed_at,
    a.updated_at,
    a.created_at
  )
  from public.intermediary_onboarding_applications a
  left join public.posp_misp_onboarding_profiles p
    on p.application_id = a.id
  where a.id = p_application_id
    and (
      a.partner_status = 'active_partner'
      or a.registration_status = 'iib_registered'
    )
  limit 1;
$$;

revoke all on function public.intermediary_activation_timestamp_for_application(uuid) from public;
revoke all on function public.intermediary_activation_timestamp_for_application(uuid) from anon;
revoke all on function public.intermediary_activation_timestamp_for_application(uuid) from authenticated;
grant execute on function public.intermediary_activation_timestamp_for_application(uuid) to service_role;

-- When an intermediary row is created or resynchronised after the application
-- is already active, stamp the original activation time instead of leaving it
-- blank. Existing timestamps are never overwritten.
create or replace function public.set_intermediary_activation_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activated_at timestamptz;
begin
  if new.activated_at is null and new.application_id is not null then
    v_activated_at := public.intermediary_activation_timestamp_for_application(new.application_id);

    if v_activated_at is not null then
      new.activated_at := v_activated_at;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.set_intermediary_activation_timestamp() from public;
revoke all on function public.set_intermediary_activation_timestamp() from anon;
revoke all on function public.set_intermediary_activation_timestamp() from authenticated;

drop trigger if exists intermediary_set_activation_timestamp
  on public.intermediaries;
create trigger intermediary_set_activation_timestamp
before insert or update of application_id, account_status
on public.intermediaries
for each row
execute function public.set_intermediary_activation_timestamp();

-- When the application itself crosses its final activation boundary, update an
-- intermediary row that may already exist. This covers normal Partner
-- activation and POSP/MISP completion through IIB registration.
create or replace function public.sync_intermediary_activation_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activated_at timestamptz;
begin
  if (
    new.partner_status = 'active_partner'
    or new.registration_status = 'iib_registered'
  ) then
    v_activated_at := public.intermediary_activation_timestamp_for_application(new.id);

    if v_activated_at is not null then
      update public.intermediaries
      set activated_at = coalesce(activated_at, v_activated_at),
          updated_at = now()
      where application_id = new.id
        and activated_at is null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_intermediary_activation_from_application() from public;
revoke all on function public.sync_intermediary_activation_from_application() from anon;
revoke all on function public.sync_intermediary_activation_from_application() from authenticated;

drop trigger if exists application_sync_intermediary_activation_timestamp
  on public.intermediary_onboarding_applications;
create trigger application_sync_intermediary_activation_timestamp
after insert or update of partner_status, registration_status
on public.intermediary_onboarding_applications
for each row
execute function public.sync_intermediary_activation_from_application();

-- Repair historical active rows. Prefer the registration activation timestamp,
-- then persisted onboarding timestamps, and use the application's own lifecycle
-- timestamps only as a controlled fallback. Never replace an existing date.
update public.intermediaries i
set activated_at = public.intermediary_activation_timestamp_for_application(i.application_id),
    updated_at = now()
where i.application_id is not null
  and i.activated_at is null
  and public.intermediary_activation_timestamp_for_application(i.application_id) is not null;

commit;
