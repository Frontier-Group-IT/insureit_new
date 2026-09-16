-- Compact system-generated POSP/MISP registration IDs.
--
-- New system-generated codes become POSP00001 / MISP00001.
-- Existing registrations created through the legacy/existing onboarding flow are
-- intentionally preserved exactly as entered. Only records whose onboarding
-- profile is marked record_source = 'new_onboarding' are migrated.

create or replace function public.next_registration_code(p_type text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_type = 'posp' then
    return 'POSP' || lpad(nextval('public.posp_code_sequence')::text, 5, '0');
  elsif p_type = 'misp' then
    return 'MISP' || lpad(nextval('public.misp_code_sequence')::text, 5, '0');
  end if;
  raise exception 'Unsupported registration type: %', p_type;
end;
$function$;

create or replace function public.next_posp_identity()
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select 'POSP' || lpad(nextval('public.posp_identity_seq')::text, 5, '0');
$function$;

do $migration$
declare
  v_conflict text;
begin
  create temporary table _compact_registration_map (
    application_id uuid primary key,
    registration_id uuid not null,
    registration_type text not null,
    old_code text not null,
    new_code text not null
  ) on commit drop;

  insert into _compact_registration_map (
    application_id,
    registration_id,
    registration_type,
    old_code,
    new_code
  )
  select
    r.application_id,
    r.id,
    r.registration_type,
    r.registration_code,
    case
      when r.registration_type = 'posp' then 'POSP' || substring(r.registration_code from '([0-9]{5})$')
      when r.registration_type = 'misp' then 'MISP' || substring(r.registration_code from '([0-9]{5})$')
    end
  from public.intermediary_registrations r
  join public.posp_misp_onboarding_profiles p
    on p.application_id = r.application_id
  where p.record_source = 'new_onboarding'
    and (
      (r.registration_type = 'posp' and r.registration_code ~ '^POSP-[0-9]{4}-[0-9]{5}$')
      or
      (r.registration_type = 'misp' and r.registration_code ~ '^MISP-[0-9]{4}-[0-9]{5}$')
    );

  -- Refuse to migrate if a compact target code is already in use by a
  -- different registration/profile/intermediary. This keeps the data move
  -- deterministic and prevents a silent identifier collision.
  select m.new_code
    into v_conflict
  from _compact_registration_map m
  where exists (
      select 1
      from public.intermediary_registrations r
      where r.registration_code = m.new_code
        and r.id <> m.registration_id
    )
    or exists (
      select 1
      from public.posp_misp_onboarding_profiles p
      where p.external_onboarding_id = m.new_code
        and p.application_id <> m.application_id
    )
    or exists (
      select 1
      from public.intermediaries i
      where (i.intermediary_code = m.new_code or i.onboarding_id = m.new_code)
        and (i.application_id is null or i.application_id <> m.application_id)
    )
  limit 1;

  if v_conflict is not null then
    raise exception 'Compact POSP/MISP registration ID % is already in use.', v_conflict;
  end if;

  update public.intermediary_registrations r
     set registration_code = m.new_code,
         updated_at = now()
    from _compact_registration_map m
   where r.id = m.registration_id;

  update public.posp_misp_onboarding_profiles p
     set external_onboarding_id = m.new_code,
         posp_id = case when m.registration_type = 'posp' and p.posp_id = m.old_code then m.new_code else p.posp_id end,
         existing_registration_code = case when p.existing_registration_code = m.old_code then m.new_code else p.existing_registration_code end,
         raw_data = case
           when p.raw_data ->> 'issued_registration_code' = m.old_code
             then jsonb_set(coalesce(p.raw_data, '{}'::jsonb), '{issued_registration_code}', to_jsonb(m.new_code), true)
           else p.raw_data
         end,
         updated_at = now()
    from _compact_registration_map m
   where p.application_id = m.application_id;

  update public.intermediaries i
     set intermediary_code = case when i.intermediary_code = m.old_code then m.new_code else i.intermediary_code end,
         onboarding_id = case when i.onboarding_id = m.old_code then m.new_code else i.onboarding_id end,
         updated_at = now()
    from _compact_registration_map m
   where i.application_id = m.application_id
     and (i.intermediary_code = m.old_code or i.onboarding_id = m.old_code);

  update public.intermediary_onboarding_applications a
     set draft_data = case
           when a.draft_data ->> 'issued_registration_code' = m.old_code
             then jsonb_set(coalesce(a.draft_data, '{}'::jsonb), '{issued_registration_code}', to_jsonb(m.new_code), true)
           else a.draft_data
         end,
         updated_at = now()
    from _compact_registration_map m
   where a.id = m.application_id;
end;
$migration$;
