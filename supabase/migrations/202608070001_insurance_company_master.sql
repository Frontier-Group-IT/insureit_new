-- INSUREIT canonical insurance company master.
-- Additive migration: preserves existing UUIDs, policies, claims and surveyor references.
-- Portal credentials from the source workbook are intentionally NOT stored here.

alter table public.insurance_companies
  add column if not exists segment text,
  add column if not exists sibpl_code text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'insurance_companies_segment_check'
      and conrelid = 'public.insurance_companies'::regclass
  ) then
    alter table public.insurance_companies
      add constraint insurance_companies_segment_check
      check (segment is null or segment in ('general','health','life'));
  end if;
end $$;

create index if not exists insurance_companies_segment_idx
  on public.insurance_companies(segment);
create index if not exists insurance_companies_active_name_idx
  on public.insurance_companies(is_active, name);
create index if not exists insurance_companies_sibpl_code_idx
  on public.insurance_companies(sibpl_code);

create table if not exists public.insurance_company_aliases (
  id uuid primary key default gen_random_uuid(),
  insurance_company_id uuid not null references public.insurance_companies(id) on delete cascade,
  alias text not null,
  source text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists insurance_company_aliases_alias_ci_uidx
  on public.insurance_company_aliases(lower(alias));
create index if not exists insurance_company_aliases_company_idx
  on public.insurance_company_aliases(insurance_company_id);

drop trigger if exists insurance_company_aliases_updated_at on public.insurance_company_aliases;
create trigger insurance_company_aliases_updated_at
before update on public.insurance_company_aliases
for each row execute function public.set_updated_at();

alter table public.insurance_company_aliases enable row level security;

drop policy if exists "insurance company aliases ops manage" on public.insurance_company_aliases;
create policy "insurance company aliases ops manage"
on public.insurance_company_aliases for all to authenticated
using (public.is_operations_role())
with check (public.is_operations_role());

insert into public.insurance_companies
  (name, segment, sibpl_code, claims_portal_url, is_active)
values
  ('Royal Sundaram General Insurance Company Limited', 'general', 'BR502821 / BA519545', 'https://ilounge.royalsundaram.in/iPolicyMotor/login', true),
  ('ICICI Lombard General Insurance Company Limited', 'general', 'DB115626', 'https://nysa.icicilombard.com/#/login', true),
  ('Go Digit General Insurance Limited', 'general', '1223668', 'https://accounts.godigit.com/auth/realms/ABS-21/protocol/openid-connect/auth?client_id=DigitPlus&redirect_uri=https%3A%2F%2Fplus.godigit.com%2F%23%2Fredirection&state=4aa06d8e-bf10-4ff6-aba9-60abf7630050&response_mode=fragment&response_type=code&scope=openid&nonce=399ec20c-69b2-4120-85a2-0d3bb300e3a3&code_challenge=UNZ0R9plwmSExBbVdx2j_xyZfrXieT-D0yEryvbn-xE&code_challenge_method=S256', true),
  ('Generali Central Insurance Company Limited', 'general', '60122296', 'https://partners.fggeneral.in/nonlifeadvisor/login', true),
  ('Tata AIG General Insurance Company Limited', 'general', '3162920000', 'https://sellonline.tataaig.com/ipdsv2/login/#/login', true),
  ('IFFCO Tokio General Insurance Company Limited', 'general', '13002229', 'https://sso.iffcotokio.co.in/finsechannel_enu/start.swe?SWECmd=GotoView&SWEView=ITGI+Auto+Policy+Screen+Homepage+View&SWERF=1&SWEHo=sso.iffcotokio.co.in&SWEBU=1', true),
  ('IndusInd General Insurance Company Limited', 'general', '26BRG1056', 'https://smartzone.reliancegeneral.co.in/Login/IMDLogin?ReturnUrl=%2f', true),
  ('Zurich Kotak General Insurance Company (India) Limited', 'general', '3929230000', 'https://pace.zurichkotak.com/', true),
  ('Shriram General Insurance Company Limited', 'general', 'LCN000000400', 'https://novaconnector.shriramgi.com/novaconnect/login', true),
  ('Magma General Insurance Limited', 'general', '10000104459', 'https://agents.magmainsurance.com/PORTAL/SitePages/Landing.aspx', true),
  ('Cholamandalam MS General Insurance Company Limited', 'general', '290000032470714', 'https://epolicy.cholainsurance.com/epolicy/logon/frmeportalhome.aspx', true),
  ('National Insurance Company Limited', 'general', '91104400000001', 'https://nicportal.nic.co.in/nicportal/signin/login', true),
  ('SBI General Insurance Company Limited', 'general', '548612', 'https://dip.sbigeneral.in/Login/LoginSBI', true),
  ('Kiwi General Insurance Limited', 'general', 'KW001255', 'https://corehub.kiwiinsurance.com', true),
  ('The Oriental Insurance Company Limited', 'general', 'LC0000001066', 'https://orientalinsurance.org.in/', true),
  ('HDFC ERGO General Insurance Company Limited', 'general', '201111586635', 'https://1up.hdfcergo.com/', true),
  ('Universal Sompo General Insurance Company Limited', 'general', '200509813043', 'https://agencyforce.universalsompo.com/', true),
  ('Liberty General Insurance Limited', 'general', 'IMD2000447', 'https://partnerfirst.libertyinsurance.in/', true),
  ('United India Insurance Company Limited', 'general', 'BRC0001429', 'https://www.uiic.in/GCWebPortal/login/LoginAction.do?p=login', true),
  ('The New India Assurance Company Limited', 'general', 'BR00002268', null, true),
  ('Zuno General Insurance Limited', 'general', '2210005067', 'https://share.google/N6nrneAF2NpQjTHEL', true),
  ('Niva Bupa Health Insurance Company Limited', 'health', 'BR09090001', null, true),
  ('Aditya Birla Sun Life Insurance Company Limited', 'life', 'AKU037', null, true),
  ('Bandhan Life Insurance Limited', 'life', '30000163', null, true),
  ('HDFC Life Insurance Company Limited', 'life', 'CWB20902', null, true),
  ('Pramerica Life Insurance Limited', 'life', 'BRR391', null, true),
  ('PNB MetLife India Insurance Company Limited', 'life', '70693423', null, true),
  ('Bajaj Life Insurance Limited', 'life', '7000700777', null, true),
  ('Go Digit Life Insurance Limited', 'life', '1223668', null, true),
  ('Bajaj General Insurance Limited', 'general', 'Pending', null, true),
  ('Care Health Insurance Limited', 'health', 'Pending', null, true),
  ('Star Health and Allied Insurance Company Limited', 'health', 'Pending', null, true),
  ('Tata AIA Life Insurance Company Limited', 'life', 'Pending', null, true),
  ('Life Insurance Corporation of India', 'life', 'Pending', null, true),
  ('Axis Max Life Insurance Limited', 'life', 'UZS55/UZ326', null, true)
on conflict (name) do update
set
  segment = excluded.segment,
  sibpl_code = excluded.sibpl_code,
  claims_portal_url = excluded.claims_portal_url,
  is_active = true,
  updated_at = now();

-- Preserve old/dummy UUIDs for referential integrity, but remove them from new-policy selection.
update public.insurance_companies
set is_active = false,
    updated_at = now()
where name not in (
  'Royal Sundaram General Insurance Company Limited',
  'ICICI Lombard General Insurance Company Limited',
  'Go Digit General Insurance Limited',
  'Generali Central Insurance Company Limited',
  'Tata AIG General Insurance Company Limited',
  'IFFCO Tokio General Insurance Company Limited',
  'IndusInd General Insurance Company Limited',
  'Zurich Kotak General Insurance Company (India) Limited',
  'Shriram General Insurance Company Limited',
  'Magma General Insurance Limited',
  'Cholamandalam MS General Insurance Company Limited',
  'National Insurance Company Limited',
  'SBI General Insurance Company Limited',
  'Kiwi General Insurance Limited',
  'The Oriental Insurance Company Limited',
  'HDFC ERGO General Insurance Company Limited',
  'Universal Sompo General Insurance Company Limited',
  'Liberty General Insurance Limited',
  'United India Insurance Company Limited',
  'The New India Assurance Company Limited',
  'Zuno General Insurance Limited',
  'Niva Bupa Health Insurance Company Limited',
  'Aditya Birla Sun Life Insurance Company Limited',
  'Bandhan Life Insurance Limited',
  'HDFC Life Insurance Company Limited',
  'Pramerica Life Insurance Limited',
  'PNB MetLife India Insurance Company Limited',
  'Bajaj Life Insurance Limited',
  'Go Digit Life Insurance Limited',
  'Bajaj General Insurance Limited',
  'Care Health Insurance Limited',
  'Star Health and Allied Insurance Company Limited',
  'Tata AIA Life Insurance Company Limited',
  'Life Insurance Corporation of India',
  'Axis Max Life Insurance Limited'
);

-- Seed canonical OCR/search aliases. Legal names remain the source of truth.
insert into public.insurance_company_aliases (insurance_company_id, alias, source)
select c.id, x.alias, x.source
from (
  values
    ('Go Digit General Insurance Limited', 'Digit General Insurance Limited', 'ocr'),
    ('Go Digit General Insurance Limited', 'Go Digit General Insurance Ltd.', 'ocr'),
    ('Go Digit General Insurance Limited', 'GoDigit', 'search'),
    ('IFFCO Tokio General Insurance Company Limited', 'IFFCO-TOKIO GENERAL INSURANCE CO.LTD', 'ocr'),
    ('IFFCO Tokio General Insurance Company Limited', 'IFFCO Tokio', 'search'),
    ('The New India Assurance Company Limited', 'The New India Assurance Co. Ltd.', 'ocr'),
    ('The New India Assurance Company Limited', 'New India', 'search'),
    ('United India Insurance Company Limited', 'UNITED INDIA INSURANCE COMPANY LIMITED', 'ocr'),
    ('IndusInd General Insurance Company Limited', 'Reliance General Insurance Company Limited', 'legacy'),
    ('Zurich Kotak General Insurance Company (India) Limited', 'Kotak General Insurance', 'legacy'),
    ('Generali Central Insurance Company Limited', 'Future Generali India Insurance Company Limited', 'legacy'),
    ('Bajaj General Insurance Limited', 'Bajaj Allianz General Insurance Company Limited', 'legacy'),
    ('Bajaj Life Insurance Limited', 'Bajaj Allianz Life Insurance Company Limited', 'legacy'),
    ('Axis Max Life Insurance Limited', 'Max Life Insurance Company Limited', 'legacy')
) as x(company_name, alias, source)
join public.insurance_companies c on c.name = x.company_name
on conflict (lower(alias)) do nothing;
