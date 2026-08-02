begin;

create table if not exists public.intermediary_register_cleanup_audit (
  id uuid primary key default gen_random_uuid(),
  intermediary_id uuid not null,
  cleanup_reason text not null,
  related_deletion_audit_id uuid,
  snapshot jsonb not null,
  cleaned_at timestamptz not null default now()
);

create unique index if not exists intermediary_register_cleanup_audit_row_reason_idx
  on public.intermediary_register_cleanup_audit (intermediary_id, cleanup_reason);

alter table public.intermediary_register_cleanup_audit enable row level security;
revoke all on table public.intermediary_register_cleanup_audit from public;
revoke all on table public.intermediary_register_cleanup_audit from anon;
revoke all on table public.intermediary_register_cleanup_audit from authenticated;
grant all on table public.intermediary_register_cleanup_audit to service_role;

-- Child profiles retain their parent Partner ID, but they must never own a
-- second intermediary register row with intermediary_type = 'partner'.
insert into public.intermediary_register_cleanup_audit (
  intermediary_id,
  cleanup_reason,
  snapshot
)
select
  i.id,
  'partner_row_attached_to_child_application',
  to_jsonb(i)
from public.intermediaries i
join public.intermediary_onboarding_applications a
  on a.id = i.application_id
where i.intermediary_type = 'partner'
  and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp')
on conflict (intermediary_id, cleanup_reason) do nothing;

delete from public.intermediaries i
using public.intermediary_onboarding_applications a
where a.id = i.application_id
  and i.intermediary_type = 'partner'
  and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp');

-- Rows that still point to an application which no longer exists are invalid.
insert into public.intermediary_register_cleanup_audit (
  intermediary_id,
  cleanup_reason,
  snapshot
)
select
  i.id,
  'missing_application',
  to_jsonb(i)
from public.intermediaries i
where i.application_id is not null
  and not exists (
    select 1
    from public.intermediary_onboarding_applications a
    where a.id = i.application_id
  )
on conflict (intermediary_id, cleanup_reason) do nothing;

delete from public.intermediaries i
where i.application_id is not null
  and not exists (
    select 1
    from public.intermediary_onboarding_applications a
    where a.id = i.application_id
  );

-- Some historical deletions may have left application_id null. Remove only
-- POSP/MISP rows whose permanent code is recorded in a successful deletion
-- audit. Preserve a JSON snapshot before cleanup.
insert into public.intermediary_register_cleanup_audit (
  intermediary_id,
  cleanup_reason,
  related_deletion_audit_id,
  snapshot
)
select
  i.id,
  'deleted_registration_with_null_application',
  matched_deletion.id,
  to_jsonb(i)
from public.intermediaries i
join lateral (
  select d.id
  from public.intermediary_account_deletion_audit d
  where d.deletion_mode in ('child', 'partner')
    and (
      nullif(btrim(i.intermediary_code), '') = any(d.deleted_registration_codes)
      or nullif(btrim(i.onboarding_id), '') = any(d.deleted_registration_codes)
    )
  order by d.deleted_at desc
  limit 1
) matched_deletion on true
where i.application_id is null
  and i.intermediary_type in ('posp', 'misp')
on conflict (intermediary_id, cleanup_reason) do nothing;

delete from public.intermediaries i
where i.application_id is null
  and i.intermediary_type in ('posp', 'misp')
  and exists (
    select 1
    from public.intermediary_account_deletion_audit d
    where d.deletion_mode in ('child', 'partner')
      and (
        nullif(btrim(i.intermediary_code), '') = any(d.deleted_registration_codes)
        or nullif(btrim(i.onboarding_id), '') = any(d.deleted_registration_codes)
      )
  );

-- A successful account deletion must also clean any orphaned register row
-- carrying one of the deleted registration codes. This runs inside the same
-- database transaction as the deletion audit insert.
create or replace function public.cleanup_deleted_intermediary_register_rows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.intermediary_register_cleanup_audit (
    intermediary_id,
    cleanup_reason,
    related_deletion_audit_id,
    snapshot
  )
  select
    i.id,
    'post_deletion_orphan',
    new.id,
    to_jsonb(i)
  from public.intermediaries i
  where (
      (new.deletion_mode = 'child' and i.intermediary_type in ('posp', 'misp'))
      or new.deletion_mode = 'partner'
    )
    and (
      nullif(btrim(i.intermediary_code), '') = any(new.deleted_registration_codes)
      or nullif(btrim(i.onboarding_id), '') = any(new.deleted_registration_codes)
    )
    and (
      i.application_id is null
      or not exists (
        select 1
        from public.intermediary_onboarding_applications a
        where a.id = i.application_id
      )
    )
  on conflict (intermediary_id, cleanup_reason) do nothing;

  delete from public.intermediaries i
  where (
      (new.deletion_mode = 'child' and i.intermediary_type in ('posp', 'misp'))
      or new.deletion_mode = 'partner'
    )
    and (
      nullif(btrim(i.intermediary_code), '') = any(new.deleted_registration_codes)
      or nullif(btrim(i.onboarding_id), '') = any(new.deleted_registration_codes)
    )
    and (
      i.application_id is null
      or not exists (
        select 1
        from public.intermediary_onboarding_applications a
        where a.id = i.application_id
      )
    );

  return new;
end;
$$;

revoke all on function public.cleanup_deleted_intermediary_register_rows() from public;
revoke all on function public.cleanup_deleted_intermediary_register_rows() from anon;
revoke all on function public.cleanup_deleted_intermediary_register_rows() from authenticated;

drop trigger if exists trg_cleanup_deleted_intermediary_register_rows
  on public.intermediary_account_deletion_audit;
create trigger trg_cleanup_deleted_intermediary_register_rows
after insert on public.intermediary_account_deletion_audit
for each row
execute function public.cleanup_deleted_intermediary_register_rows();

-- Synchronize a Partner register row only for the permanent parent Partner
-- application. POSP/MISP child profiles also carry partner_id for linkage and
-- must not create a second Partner row.
create or replace function public.sync_partner_intermediary(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_existing_id uuid;
  v_account_context text;
begin
  select
    p.application_id,
    p.partner_id,
    p.partner_type,
    p.external_onboarding_id,
    case
      when p.partner_type = 'misp'
        then coalesce(p.misp_name, p.dp_name, 'Business Partner')
      else coalesce(p.pos_name, p.dp_name, 'Individual Partner')
    end as display_name,
    case when p.partner_type = 'misp' then p.dp_phone else p.applicant_phone end as mobile,
    case when p.partner_type = 'misp' then p.dp_email else p.applicant_email end as email,
    p.city,
    p.iib_remarks,
    coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') as account_context
  into v_profile
  from public.posp_misp_onboarding_profiles p
  join public.intermediary_onboarding_applications a
    on a.id = p.application_id
  where p.application_id = p_application_id
    and p.partner_id is not null;

  if not found then
    return;
  end if;

  v_account_context := v_profile.account_context;

  if v_account_context in ('posp', 'misp') then
    insert into public.intermediary_register_cleanup_audit (
      intermediary_id,
      cleanup_reason,
      snapshot
    )
    select
      i.id,
      'partner_row_attached_to_child_application',
      to_jsonb(i)
    from public.intermediaries i
    where i.application_id = p_application_id
      and i.intermediary_type = 'partner'
    on conflict (intermediary_id, cleanup_reason) do nothing;

    delete from public.intermediaries
    where application_id = p_application_id
      and intermediary_type = 'partner';
    return;
  end if;

  select id into v_existing_id
  from public.intermediaries
  where application_id = p_application_id
    and intermediary_type = 'partner'
  limit 1;

  if v_existing_id is null then
    insert into public.intermediaries (
      application_id,
      intermediary_code,
      onboarding_id,
      intermediary_type,
      requested_type,
      display_name,
      mobile,
      email,
      city,
      iib_status,
      compliance_status,
      account_status,
      portal_access_status,
      visibility_level,
      created_at,
      updated_at
    ) values (
      v_profile.application_id,
      v_profile.partner_id,
      v_profile.external_onboarding_id,
      'partner',
      v_profile.partner_type,
      v_profile.display_name,
      v_profile.mobile,
      v_profile.email,
      v_profile.city,
      coalesce(v_profile.iib_remarks, 'pending'),
      'pending',
      'active',
      'not_created',
      'internal',
      now(),
      now()
    );
  else
    update public.intermediaries
    set intermediary_code = v_profile.partner_id,
        onboarding_id = v_profile.external_onboarding_id,
        requested_type = v_profile.partner_type,
        display_name = v_profile.display_name,
        mobile = v_profile.mobile,
        email = v_profile.email,
        city = v_profile.city,
        iib_status = coalesce(v_profile.iib_remarks, iib_status),
        account_status = 'active',
        updated_at = now()
    where id = v_existing_id;
  end if;
end;
$$;

-- Reconcile all profiles once with the corrected parent/child rule.
do $$
declare
  r record;
begin
  for r in
    select application_id
    from public.posp_misp_onboarding_profiles
    where partner_id is not null
  loop
    perform public.sync_partner_intermediary(r.application_id);
  end loop;
end;
$$;

commit;
