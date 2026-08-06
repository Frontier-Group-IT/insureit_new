begin;

-- Activation eligibility is account-context specific:
-- * parent Partner applications activate at active_partner
-- * child POSP/MISP applications activate only at iib_registered
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
      (
        coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') = 'partner'
        and a.partner_status = 'active_partner'
      )
      or
      (
        coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp')
        and a.registration_status = 'iib_registered'
      )
    )
  limit 1;
$$;

revoke all on function public.intermediary_activation_timestamp_for_application(uuid) from public;
revoke all on function public.intermediary_activation_timestamp_for_application(uuid) from anon;
revoke all on function public.intermediary_activation_timestamp_for_application(uuid) from authenticated;
grant execute on function public.intermediary_activation_timestamp_for_application(uuid) to service_role;

-- Remove timestamps incorrectly assigned to child accounts before final IIB
-- registration. Partner activation on the parent record remains untouched.
update public.intermediaries i
set activated_at = null,
    updated_at = now()
from public.intermediary_onboarding_applications a
where a.id = i.application_id
  and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') in ('posp', 'misp')
  and a.registration_status is distinct from 'iib_registered'
  and i.activated_at is not null;

-- Ensure truly active records remain populated after tightening eligibility.
update public.intermediaries i
set activated_at = public.intermediary_activation_timestamp_for_application(i.application_id),
    updated_at = now()
where i.application_id is not null
  and i.activated_at is null
  and public.intermediary_activation_timestamp_for_application(i.application_id) is not null;

commit;
