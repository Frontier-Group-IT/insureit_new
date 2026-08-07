-- Production migration history alignment for insurer aliases used by workbook/OCR matching.

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
