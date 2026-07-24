-- Split POSP/MISP onboarding into pre-IIB, IIB and training stages.
-- Bank names become validated master data while the original text remains as an audit snapshot.

create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  normalized_name text not null unique,
  category text not null check (
    category in (
      'public_sector',
      'private_sector',
      'local_area',
      'small_finance',
      'payments',
      'regional_rural',
      'foreign'
    )
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.banks (name, normalized_name, category)
select
  source.name,
  lower(regexp_replace(source.name, '[^[:alnum:]]', '', 'g')),
  source.category
from (values
  ('State Bank of India', 'public_sector'),
  ('Bank of Baroda', 'public_sector'),
  ('Bank of India', 'public_sector'),
  ('Bank of Maharashtra', 'public_sector'),
  ('Canara Bank', 'public_sector'),
  ('Central Bank of India', 'public_sector'),
  ('Indian Bank', 'public_sector'),
  ('Indian Overseas Bank', 'public_sector'),
  ('Punjab & Sind Bank', 'public_sector'),
  ('Punjab National Bank', 'public_sector'),
  ('UCO Bank', 'public_sector'),
  ('Union Bank of India', 'public_sector'),
  ('Axis Bank Limited', 'private_sector'),
  ('Bandhan Bank Limited', 'private_sector'),
  ('CSB Bank Limited', 'private_sector'),
  ('City Union Bank Limited', 'private_sector'),
  ('DCB Bank Limited', 'private_sector'),
  ('Dhanlaxmi Bank Limited', 'private_sector'),
  ('Federal Bank Limited', 'private_sector'),
  ('HDFC Bank Limited', 'private_sector'),
  ('ICICI Bank Limited', 'private_sector'),
  ('IndusInd Bank Limited', 'private_sector'),
  ('IDFC FIRST Bank Limited', 'private_sector'),
  ('Jammu & Kashmir Bank Limited', 'private_sector'),
  ('Karnataka Bank Limited', 'private_sector'),
  ('Karur Vysya Bank Limited', 'private_sector'),
  ('Kotak Mahindra Bank Limited', 'private_sector'),
  ('Nainital Bank Limited', 'private_sector'),
  ('RBL Bank Limited', 'private_sector'),
  ('South Indian Bank Limited', 'private_sector'),
  ('Tamilnad Mercantile Bank Limited', 'private_sector'),
  ('YES Bank Limited', 'private_sector'),
  ('IDBI Bank Limited', 'private_sector'),
  ('Coastal Local Area Bank Limited', 'local_area'),
  ('Krishna Bhima Samruddhi Local Area Bank Limited', 'local_area'),
  ('AU Small Finance Bank Limited', 'small_finance'),
  ('Capital Small Finance Bank Limited', 'small_finance'),
  ('Equitas Small Finance Bank Limited', 'small_finance'),
  ('ESAF Small Finance Bank Limited', 'small_finance'),
  ('Suryoday Small Finance Bank Limited', 'small_finance'),
  ('Ujjivan Small Finance Bank Limited', 'small_finance'),
  ('Utkarsh Small Finance Bank Limited', 'small_finance'),
  ('slice Small Finance Bank Limited', 'small_finance'),
  ('Jana Small Finance Bank Limited', 'small_finance'),
  ('Shivalik Small Finance Bank Limited', 'small_finance'),
  ('Unity Small Finance Bank Limited', 'small_finance'),
  ('Airtel Payments Bank Limited', 'payments'),
  ('India Post Payments Bank Limited', 'payments'),
  ('Fino Payments Bank Limited', 'payments'),
  ('Jio Payments Bank Limited', 'payments'),
  ('NSDL Payments Bank Limited', 'payments'),
  ('Andhra Pradesh Grameena Bank', 'regional_rural'),
  ('Assam Gramin Bank', 'regional_rural'),
  ('Arunachal Pradesh Rural Bank', 'regional_rural'),
  ('Bihar Gramin Bank', 'regional_rural'),
  ('Chhattisgarh Gramin Bank', 'regional_rural'),
  ('Gujarat Gramin Bank', 'regional_rural'),
  ('Haryana Gramin Bank', 'regional_rural'),
  ('Himachal Pradesh Gramin Bank', 'regional_rural'),
  ('Jharkhand Gramin Bank', 'regional_rural'),
  ('Jammu and Kashmir Grameen Bank', 'regional_rural'),
  ('Karnataka Grameena Bank', 'regional_rural'),
  ('Kerala Grameena Bank', 'regional_rural'),
  ('Maharashtra Gramin Bank', 'regional_rural'),
  ('Madhya Pradesh Gramin Bank', 'regional_rural'),
  ('Manipur Rural Bank', 'regional_rural'),
  ('Meghalaya Rural Bank', 'regional_rural'),
  ('Mizoram Rural Bank', 'regional_rural'),
  ('Nagaland Rural Bank', 'regional_rural'),
  ('Odisha Grameen Bank', 'regional_rural'),
  ('Punjab Gramin Bank', 'regional_rural'),
  ('Puducherry Grama Bank', 'regional_rural'),
  ('Rajasthan Gramin Bank', 'regional_rural'),
  ('Tamil Nadu Grama Bank', 'regional_rural'),
  ('Telangana Grameena Bank', 'regional_rural'),
  ('Tripura Gramin Bank', 'regional_rural'),
  ('Uttar Pradesh Gramin Bank', 'regional_rural'),
  ('Uttarakhand Gramin Bank', 'regional_rural'),
  ('West Bengal Gramin Bank', 'regional_rural'),
  ('AB Bank PLC', 'foreign'),
  ('American Express Banking Corporation', 'foreign'),
  ('Australia and New Zealand Banking Group Limited', 'foreign'),
  ('Barclays Bank PLC', 'foreign'),
  ('Bank of America, National Association', 'foreign'),
  ('Bank of Bahrain and Kuwait B.S.C.', 'foreign'),
  ('Bank of Ceylon', 'foreign'),
  ('Bank of China Limited', 'foreign'),
  ('Bank of Nova Scotia', 'foreign'),
  ('BNP Paribas', 'foreign'),
  ('Citibank N.A.', 'foreign'),
  ('Coöperatieve Rabobank U.A.', 'foreign'),
  ('Crédit Agricole Corporate and Investment Bank', 'foreign'),
  ('CTBC Bank Company Limited', 'foreign'),
  ('DBS Bank India Limited', 'foreign'),
  ('Deutsche Bank A.G.', 'foreign'),
  ('Doha Bank Q.P.S.C.', 'foreign'),
  ('Emirates NBD Bank P.J.S.C.', 'foreign'),
  ('First Abu Dhabi Bank PJSC', 'foreign'),
  ('FirstRand Bank Limited', 'foreign'),
  ('Hongkong and Shanghai Banking Corporation Limited — HSBC', 'foreign'),
  ('Industrial and Commercial Bank of China', 'foreign'),
  ('Industrial Bank of Korea', 'foreign'),
  ('J.P. Morgan Chase Bank N.A.', 'foreign'),
  ('JSC VTB Bank', 'foreign'),
  ('KEB Hana Bank', 'foreign'),
  ('Kookmin Bank', 'foreign'),
  ('Mashreqbank P.S.C.', 'foreign'),
  ('Mizuho Bank Limited', 'foreign'),
  ('MUFG Bank Limited', 'foreign'),
  ('NatWest Markets PLC', 'foreign'),
  ('NongHyup Bank', 'foreign'),
  ('PT Bank Maybank Indonesia TBK', 'foreign'),
  ('Qatar National Bank Q.P.S.C.', 'foreign'),
  ('Sberbank', 'foreign'),
  ('SBM Bank India Limited', 'foreign'),
  ('Shinhan Bank', 'foreign'),
  ('Société Générale', 'foreign'),
  ('Sonali Bank PLC', 'foreign'),
  ('Standard Chartered Bank', 'foreign'),
  ('Sumitomo Mitsui Banking Corporation', 'foreign'),
  ('United Overseas Bank Limited', 'foreign'),
  ('UBS AG', 'foreign'),
  ('Woori Bank', 'foreign')
) as source(name, category)
on conflict (name) do update
set
  normalized_name = excluded.normalized_name,
  category = excluded.category,
  is_active = true,
  updated_at = now();

drop trigger if exists banks_updated_at on public.banks;
create trigger banks_updated_at
before update on public.banks
for each row execute function public.set_updated_at();

alter table public.banks enable row level security;

drop policy if exists "Authenticated users can read active banks" on public.banks;
create policy "Authenticated users can read active banks"
on public.banks for select to authenticated
using (is_active);

alter table public.posp_misp_onboarding_profiles
  add column if not exists bank_id uuid references public.banks(id) on delete restrict,
  add column if not exists workflow_stage text not null default 'pre_iib',
  add column if not exists pre_iib_submitted_at timestamptz,
  add column if not exists iib_completed_at timestamptz,
  add column if not exists training_completed_at timestamptz,
  add column if not exists registration_form_generated_at timestamptz,
  add column if not exists registration_form_version text;

alter table public.posp_misp_onboarding_profiles
  drop constraint if exists posp_misp_profiles_workflow_stage_check;

alter table public.posp_misp_onboarding_profiles
  add constraint posp_misp_profiles_workflow_stage_check
  check (workflow_stage in ('pre_iib', 'iib_processing', 'training', 'completed'));

update public.posp_misp_onboarding_profiles profile
set bank_id = bank.id
from public.banks bank
where profile.bank_id is null
  and profile.bank_name is not null
  and lower(regexp_replace(profile.bank_name, '[^[:alnum:]]', '', 'g')) = bank.normalized_name;

update public.posp_misp_onboarding_profiles
set workflow_stage = case
  when onboarding_date is not null
    and exists (
      select 1
      from public.customer_onboarding_documents document
      where document.application_id = posp_misp_onboarding_profiles.application_id
        and document.document_type = 'agreement_copy'
        and document.verification_status <> 'rejected'
    ) then 'completed'
  when iib_uploaded then 'training'
  when iib_remarks is not null then 'iib_processing'
  else 'pre_iib'
end;

create index if not exists posp_misp_profiles_bank_idx
  on public.posp_misp_onboarding_profiles(bank_id);

create index if not exists posp_misp_profiles_workflow_stage_idx
  on public.posp_misp_onboarding_profiles(workflow_stage, partner_type);

create or replace function public.enforce_posp_misp_workflow_before_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_type in ('posp', 'misp')
    and new.status = 'approved'
    and old.status is distinct from 'approved'
    and not exists (
      select 1
      from public.posp_misp_onboarding_profiles profile
      where profile.application_id = new.id
        and profile.workflow_stage = 'completed'
    ) then
    raise exception 'POSP/MISP operational workflow is not complete.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_posp_misp_workflow_before_approval_trigger
  on public.customer_onboarding_applications;
create trigger enforce_posp_misp_workflow_before_approval_trigger
before update of status on public.customer_onboarding_applications
for each row execute function public.enforce_posp_misp_workflow_before_approval();

revoke all on function public.enforce_posp_misp_workflow_before_approval() from public;
