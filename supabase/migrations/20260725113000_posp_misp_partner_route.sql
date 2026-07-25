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
