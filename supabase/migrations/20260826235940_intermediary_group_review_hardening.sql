-- Address review findings for Intermediary Group policy attribution.
-- Group snapshots represent the Partner family's Group at booking/source-correction time,
-- not midnight on the policy issuance date. Existing policies remain intentionally unbackfilled.

create or replace function public.sync_policy_intermediary_group_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_partner_id uuid;
  v_group_id uuid;
  v_group_code text;
  v_group_name text;
  v_at timestamptz;
begin
  -- A policy date correction does not rewrite commercial-source history. Re-resolve only
  -- on first booking or when the source intermediary itself changes.
  if tg_op = 'UPDATE'
     and new.intermediary_code is not distinct from old.intermediary_code then
    return new;
  end if;

  new.intermediary_group_id := null;
  new.intermediary_group_code := null;
  new.intermediary_group_name := null;

  if nullif(btrim(new.intermediary_code), '') is null then
    return new;
  end if;

  select coalesce(application.partner_record_id, partner.id)
    into v_partner_id
  from public.intermediaries intermediary
  left join public.intermediary_onboarding_applications application
    on application.id = intermediary.application_id
  left join public.partners partner
    on partner.source_application_id = intermediary.application_id
  where intermediary.intermediary_code = new.intermediary_code
  order by (intermediary.account_status = 'active') desc, intermediary.updated_at desc nulls last
  limit 1;

  if v_partner_id is null then
    return new;
  end if;

  v_at := case
    when tg_op = 'INSERT' then coalesce(new.created_at, now())
    else now()
  end;

  select group_row.id, group_row.group_code, group_row.group_name
    into v_group_id, v_group_code, v_group_name
  from public.intermediary_group_memberships membership
  join public.intermediary_groups group_row on group_row.id = membership.group_id
  where membership.partner_id = v_partner_id
    and membership.effective_from <= v_at
    and (membership.effective_to is null or membership.effective_to > v_at)
  order by membership.effective_from desc
  limit 1;

  new.intermediary_group_id := v_group_id;
  new.intermediary_group_code := v_group_code;
  new.intermediary_group_name := v_group_name;
  return new;
end;
$$;

drop trigger if exists sync_policy_intermediary_group_snapshot_trigger on public.policies;
create trigger sync_policy_intermediary_group_snapshot_trigger
before insert or update of intermediary_code
on public.policies
for each row execute function public.sync_policy_intermediary_group_snapshot();

comment on function public.sync_policy_intermediary_group_snapshot() is
  'Snapshots the Partner family Intermediary Group at policy booking time or source-intermediary correction time; issuance-date edits do not rewrite historical attribution.';
