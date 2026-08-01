begin;

-- Keep the Partner register identity synchronized with the canonical Partner ID
-- stored on the onboarding profile. This repairs legacy Partner rows that were
-- activated before intermediary_code/onboarding_id were populated correctly.
create or replace function public.sync_partner_identity_to_intermediary_register(
  p_application_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id text;
  v_is_partner boolean;
begin
  select
    upper(trim(p.partner_id)),
    coalesce(a.draft_data->>'account_context', 'partner') not in ('posp', 'misp')
  into v_partner_id, v_is_partner
  from public.posp_misp_onboarding_profiles p
  join public.intermediary_onboarding_applications a on a.id = p.application_id
  where p.application_id = p_application_id;

  if not found or not v_is_partner then
    return;
  end if;

  if v_partner_id is null or v_partner_id = '' or v_partner_id like 'PENDING-%' then
    return;
  end if;

  update public.intermediaries i
     set intermediary_code = v_partner_id,
         onboarding_id = v_partner_id,
         updated_at = now()
   where i.application_id = p_application_id
     and i.intermediary_type = 'partner'
     and (
       i.intermediary_code is distinct from v_partner_id
       or i.onboarding_id is distinct from v_partner_id
     );
end;
$$;

create or replace function public.sync_partner_identity_to_register_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_partner_identity_to_intermediary_register(new.application_id);
  return new;
end;
$$;

drop trigger if exists sync_partner_identity_to_register on public.posp_misp_onboarding_profiles;
create trigger sync_partner_identity_to_register
after insert or update of partner_id on public.posp_misp_onboarding_profiles
for each row execute function public.sync_partner_identity_to_register_trigger();

-- Repair all existing Partner register rows now.
do $$
declare
  v_row record;
begin
  for v_row in
    select p.application_id
    from public.posp_misp_onboarding_profiles p
    join public.intermediary_onboarding_applications a on a.id = p.application_id
    where p.partner_id is not null
      and trim(p.partner_id) <> ''
      and upper(trim(p.partner_id)) not like 'PENDING-%'
      and coalesce(a.draft_data->>'account_context', 'partner') not in ('posp', 'misp')
  loop
    perform public.sync_partner_identity_to_intermediary_register(v_row.application_id);
  end loop;
end;
$$;

commit;
