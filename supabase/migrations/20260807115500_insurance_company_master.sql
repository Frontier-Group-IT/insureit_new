-- Canonical insurance company master for policy onboarding and OCR matching.
-- This migration is intentionally additive: existing insurer UUIDs and foreign-key references are preserved.
-- Workbook portal credentials are NOT stored in this master.

alter table public.insurance_companies
  add column if not exists segment text,
  add column if not exists sibpl_code text,
  add column if not exists portal_url text,
  add column if not exists portal_status text not null default 'not_provided',
  add column if not exists is_active boolean not null default true;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'insurance_companies_segment_check'
  ) then
    alter table public.insurance_companies
      add constraint insurance_companies_segment_check
      check (segment is null or segment in ('general', 'life', 'health'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'insurance_companies_portal_status_check'
  ) then
    alter table public.insurance_companies
      add constraint insurance_companies_portal_status_check
      check (portal_status in ('configured', 'pending', 'not_provided'));
  end if;
end
$$;

create index if not exists insurance_companies_active_segment_name_idx
  on public.insurance_companies (is_active, segment, name);

-- Existing rows are retained for referential integrity but are removed from new selections.
-- If an existing row already has the exact canonical legal name below, the upsert reactivates
-- that same UUID instead of creating a duplicate.
update public.insurance_companies
set is_active = false,
    updated_at = now();

insert into public.insurance_companies (
  name,
  segment,
  sibpl_code,
  portal_url,
  portal_status,
  is_active,
  updated_at
)
values
  ('Royal Sundaram General Insurance Co. Limited', 'general', 'BR502821 / BA519545', 'https://ilounge.royalsundaram.in/iPolicyMotor/login', 'configured', true, now()),
  ('ICICI Lombard General Insurance Company Limited', 'general', 'DB115626', 'https://nysa.icicilombard.com/#/login', 'configured', true, now()),
  ('Go Digit General Insurance Limited', 'general', '1223668', 'https://plus.godigit.com/', 'configured', true, now()),
  ('Generali Central Insurance Company Limited', 'general', '60122296', 'https://partners.fggeneral.in/nonlifeadvisor/login', 'configured', true, now()),
  ('Tata AIG General Insurance Company Limited', 'general', '3162920000', 'https://sellonline.tataaig.com/ipdsv2/login/#/login', 'configured', true, now()),
  ('IFFCO-TOKIO General Insurance Company Limited', 'general', '13002229', 'https://sso.iffcotokio.co.in/', 'configured', true, now()),
  ('IndusInd General Insurance Company Limited', 'general', '26BRG1056', 'https://smartzone.reliancegeneral.co.in/Login/IMDLogin?ReturnUrl=%2f', 'configured', true, now()),
  ('Zurich Kotak General Insurance Company (India) Limited', 'general', '3929230000', 'https://pace.zurichkotak.com/', 'configured', true, now()),
  ('Shriram General Insurance Company Limited', 'general', 'LCN000000400', 'https://novaconnector.shriramgi.com/novaconnect/login', 'configured', true, now()),
  ('Magma General Insurance Limited', 'general', '10000104459', 'https://agents.magmainsurance.com/PORTAL/SitePages/Landing.aspx', 'configured', true, now()),
  ('Cholamandalam MS General Insurance Company Limited', 'general', '290000032470714', 'https://epolicy.cholainsurance.com/epolicy/logon/frmeportalhome.aspx', 'configured', true, now()),
  ('National Insurance Company Limited', 'general', '91104400000001', 'https://nicportal.nic.co.in/nicportal/signin/login', 'configured', true, now()),
  ('SBI General Insurance Company Limited', 'general', '548612', 'https://dip.sbigeneral.in/Login/LoginSBI', 'configured', true, now()),
  ('Kiwi General Insurance Limited', 'general', 'KW001255', 'https://corehub.kiwiinsurance.com', 'configured', true, now()),
  ('The Oriental Insurance Company Limited', 'general', 'LC0000001066', 'https://orientalinsurance.org.in/', 'configured', true, now()),
  ('HDFC ERGO General Insurance Company Limited', 'general', '201111586635', 'https://1up.hdfcergo.com/', 'configured', true, now()),
  ('Universal Sompo General Insurance Company Limited', 'general', '200509813043', 'https://agencyforce.universalsompo.com/', 'configured', true, now()),
  ('Liberty General Insurance Limited', 'general', 'IMD2000447', 'https://partnerfirst.libertyinsurance.in/', 'configured', true, now()),
  ('United India Insurance Company Limited', 'general', 'BRC0001429', 'https://www.uiic.in/GCWebPortal/login/LoginAction.do?p=login', 'configured', true, now()),
  ('The New India Assurance Company Limited', 'general', 'BR00002268', null, 'pending', true, now()),
  ('Zuno General Insurance Limited', 'general', '2210005067', 'https://share.google/N6nrneAF2NpQjTHEL', 'configured', true, now()),
  ('Niva Bupa Health Insurance Company Limited', 'health', 'BR09090001', null, 'not_provided', true, now()),
  ('Aditya Birla Sun Life Insurance Company Limited', 'life', 'AKU037', null, 'not_provided', true, now()),
  ('Bandhan Life Insurance Limited', 'life', '30000163', null, 'not_provided', true, now()),
  ('HDFC Life Insurance Company Limited', 'life', 'CWB20902', null, 'not_provided', true, now()),
  ('Pramerica Life Insurance Limited', 'life', 'BRR391', null, 'not_provided', true, now()),
  ('PNB MetLife India Insurance Company Limited', 'life', '70693423', null, 'not_provided', true, now()),
  ('Bajaj Life Insurance Limited', 'life', '7000700777', null, 'not_provided', true, now()),
  ('Go Digit Life Insurance Limited', 'life', '1223668', null, 'not_provided', true, now()),
  ('Bajaj General Insurance Limited', 'general', 'Pending', null, 'pending', true, now()),
  ('Care Health Insurance Limited', 'health', 'Pending', null, 'pending', true, now()),
  ('Star Health and Allied Insurance Company Limited', 'health', 'Pending', null, 'pending', true, now()),
  ('Tata AIA Life Insurance Company Limited', 'life', 'Pending', null, 'pending', true, now()),
  ('Life Insurance Corporation of India', 'life', 'Pending', null, 'pending', true, now()),
  ('Axis Max Life Insurance Limited', 'life', 'UZS55/UZ326', null, 'not_provided', true, now())
on conflict (name) do update
set segment = excluded.segment,
    sibpl_code = excluded.sibpl_code,
    portal_url = excluded.portal_url,
    portal_status = excluded.portal_status,
    is_active = true,
    updated_at = now();

create table if not exists public.insurance_company_aliases (
  id uuid primary key default gen_random_uuid(),
  insurance_company_id uuid not null references public.insurance_companies(id) on delete cascade,
  alias text not null,
  source text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insurance_company_aliases_normalized_uidx
  on public.insurance_company_aliases (lower(trim(alias)));

create index if not exists insurance_company_aliases_company_idx
  on public.insurance_company_aliases (insurance_company_id, is_active);

drop trigger if exists insurance_company_aliases_updated_at on public.insurance_company_aliases;
create trigger insurance_company_aliases_updated_at
before update on public.insurance_company_aliases
for each row execute function public.set_updated_at();

alter table public.insurance_company_aliases enable row level security;

drop policy if exists "insurance company aliases ops manage" on public.insurance_company_aliases;
create policy "insurance company aliases ops manage"
on public.insurance_company_aliases
for all to authenticated
using (public.is_operations_role())
with check (public.is_operations_role());

-- Legacy workbook labels and OCR/legal-name variants. These aliases are non-secret and
-- provide a stable bridge from old labels and insurer policy wording to the canonical master.
insert into public.insurance_company_aliases (insurance_company_id, alias, source)
select c.id, v.alias, v.source
from public.insurance_companies c
join (values
  ('Royal Sundaram General Insurance Co. Limited', 'Royal Sundaram', 'legacy_master'),
  ('Royal Sundaram General Insurance Co. Limited', 'Royal Sundaram General Insurance Company Limited', 'variant'),
  ('ICICI Lombard General Insurance Company Limited', 'ICICI Lombard', 'legacy_master'),
  ('Go Digit General Insurance Limited', 'GoDigit Ins.', 'legacy_master'),
  ('Go Digit General Insurance Limited', 'Go Digit General Insurance Ltd.', 'ocr'),
  ('Go Digit General Insurance Limited', 'Digit General Insurance Limited', 'ocr'),
  ('Generali Central Insurance Company Limited', 'Generali Central', 'legacy_master'),
  ('Tata AIG General Insurance Company Limited', 'TATA Aig', 'legacy_master'),
  ('IFFCO-TOKIO General Insurance Company Limited', 'Iffco Tokio', 'legacy_master'),
  ('IFFCO-TOKIO General Insurance Company Limited', 'IFFCO TOKIO General Insurance Company Limited', 'variant'),
  ('IFFCO-TOKIO General Insurance Company Limited', 'IFFCO-TOKIO GENERAL INSURANCE CO.LTD', 'ocr'),
  ('IndusInd General Insurance Company Limited', 'Reliance/ Indusind', 'legacy_master'),
  ('IndusInd General Insurance Company Limited', 'Reliance General Insurance Company Limited', 'former_name'),
  ('Zurich Kotak General Insurance Company (India) Limited', 'Kotak GIC', 'legacy_master'),
  ('Zurich Kotak General Insurance Company (India) Limited', 'Kotak Mahindra General Insurance Company Limited', 'former_name'),
  ('Shriram General Insurance Company Limited', 'Shriram', 'legacy_master'),
  ('Magma General Insurance Limited', 'Magma', 'legacy_master'),
  ('Cholamandalam MS General Insurance Company Limited', 'CholaMS', 'legacy_master'),
  ('National Insurance Company Limited', 'National', 'legacy_master'),
  ('SBI General Insurance Company Limited', 'SBI', 'legacy_master'),
  ('Kiwi General Insurance Limited', 'KIWI INS.', 'legacy_master'),
  ('The Oriental Insurance Company Limited', 'Oriental', 'legacy_master'),
  ('HDFC ERGO General Insurance Company Limited', 'HDFC Ergo', 'legacy_master'),
  ('HDFC ERGO General Insurance Company Limited', 'HDFC ERGO', 'legacy_db'),
  ('Universal Sompo General Insurance Company Limited', 'Universal Sompo', 'legacy_master'),
  ('Liberty General Insurance Limited', 'Liberty Ins.', 'legacy_master'),
  ('United India Insurance Company Limited', 'United India Ins', 'legacy_master'),
  ('United India Insurance Company Limited', 'UNITED INDIA INSURANCE COMPANY LIMITED', 'ocr'),
  ('The New India Assurance Company Limited', 'New India', 'legacy_master'),
  ('The New India Assurance Company Limited', 'The New India Assurance Co. Ltd.', 'ocr'),
  ('Zuno General Insurance Limited', 'Zuno', 'legacy_master'),
  ('Zuno General Insurance Limited', 'Edelweiss General Insurance Company Limited', 'former_name'),
  ('Niva Bupa Health Insurance Company Limited', 'Niva Bupa', 'legacy_master'),
  ('Aditya Birla Sun Life Insurance Company Limited', 'Adiya Birla', 'legacy_master'),
  ('Bandhan Life Insurance Limited', 'Bandhan Life', 'legacy_master'),
  ('Bandhan Life Insurance Limited', 'Bandhan Life Insurance Company Limited', 'variant'),
  ('HDFC Life Insurance Company Limited', 'Hdfc Life', 'legacy_master'),
  ('Pramerica Life Insurance Limited', 'Pramerica Life', 'legacy_master'),
  ('Pramerica Life Insurance Limited', 'Pramerica Life Insurance Company Limited', 'variant'),
  ('PNB MetLife India Insurance Company Limited', 'PNB Metlife', 'legacy_master'),
  ('Bajaj Life Insurance Limited', 'Bajaj Life Ins', 'legacy_master'),
  ('Bajaj Life Insurance Limited', 'Bajaj Allianz Life Insurance Company Limited', 'former_name'),
  ('Go Digit Life Insurance Limited', 'Godigit life', 'legacy_master'),
  ('Bajaj General Insurance Limited', 'Bajaj', 'legacy_master'),
  ('Bajaj General Insurance Limited', 'Bajaj Allianz General Insurance Company Limited', 'former_name'),
  ('Care Health Insurance Limited', 'Care Health', 'legacy_master'),
  ('Star Health and Allied Insurance Company Limited', 'Star', 'legacy_master'),
  ('Tata AIA Life Insurance Company Limited', 'Tata Aia', 'legacy_master'),
  ('Life Insurance Corporation of India', 'LIC of India', 'legacy_master'),
  ('Axis Max Life Insurance Limited', 'AxisMax Life', 'legacy_master'),
  ('Axis Max Life Insurance Limited', 'Max Life Insurance Company Limited', 'former_name')
) as v(company_name, alias, source)
  on c.name = v.company_name
on conflict do nothing;
