begin;

alter table public.posp_misp_onboarding_profiles
  add column if not exists requested_account_type text,
  add column if not exists final_account_type text,
  add column if not exists partner_decision text not null default 'not_applicable',
  add column if not exists partner_decision_at timestamptz,
  add column if not exists partner_decision_by uuid,
  add column if not exists partner_decision_remark text;

update public.posp_misp_onboarding_profiles
set requested_account_type = coalesce(requested_account_type, partner_type),
    final_account_type = case
      when final_account_type is not null then final_account_type
      when iib_remarks = 'No Data Found In POS System' then partner_type
      else null
    end,
    partner_decision = case
      when iib_remarks = 'Matching Record Found In DataBase' and partner_decision = 'not_applicable' then 'pending'
      else partner_decision
    end;

alter table public.posp_misp_onboarding_profiles
  drop constraint if exists posp_misp_onboarding_profiles_requested_account_type_check,
  drop constraint if exists posp_misp_onboarding_profiles_final_account_type_check,
  drop constraint if exists posp_misp_onboarding_profiles_partner_decision_check;

alter table public.posp_misp_onboarding_profiles
  add constraint posp_misp_onboarding_profiles_requested_account_type_check
    check (requested_account_type is null or requested_account_type in ('posp','misp')),
  add constraint posp_misp_onboarding_profiles_final_account_type_check
    check (final_account_type is null or final_account_type in ('posp','misp','partner')),
  add constraint posp_misp_onboarding_profiles_partner_decision_check
    check (partner_decision in ('not_applicable','pending','convert_to_partner','do_not_proceed'));

create index if not exists posp_misp_partner_decision_idx
  on public.posp_misp_onboarding_profiles(partner_decision);

create or replace function public.queue_posp_misp_pan_on_profile_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workflow_stage = 'pre_iib'
     and new.bank_id is not null
     and new.pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
     and exists (
       select 1
       from public.customer_onboarding_applications app
       where app.id = new.application_id
         and app.status in ('submitted','under_review','changes_requested')
     ) then
    insert into public.pan_verification_jobs (
      application_id,
      onboarding_profile_id,
      partner_type,
      pan_number,
      status,
      requested_at,
      updated_at
    ) values (
      new.application_id,
      new.id,
      new.partner_type,
      new.pan_number,
      'pending',
      now(),
      now()
    )
    on conflict (application_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists queue_posp_misp_pan_when_ready on public.posp_misp_onboarding_profiles;
create trigger queue_posp_misp_pan_when_ready
after insert or update of pan_number, bank_id, workflow_stage
on public.posp_misp_onboarding_profiles
for each row execute function public.queue_posp_misp_pan_on_profile_ready();

insert into public.pan_verification_jobs (
  application_id,
  onboarding_profile_id,
  partner_type,
  pan_number,
  status,
  requested_at,
  updated_at
)
select profile.application_id, profile.id, profile.partner_type, profile.pan_number, 'pending', now(), now()
from public.posp_misp_onboarding_profiles profile
join public.customer_onboarding_applications app on app.id = profile.application_id
where profile.workflow_stage = 'pre_iib'
  and profile.bank_id is not null
  and profile.pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'
  and app.status in ('submitted','under_review','changes_requested')
on conflict (application_id) do nothing;

commit;
