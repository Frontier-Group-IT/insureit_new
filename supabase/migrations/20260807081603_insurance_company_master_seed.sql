-- Production migration history alignment for the canonical insurance company seed.
-- Existing insurer UUIDs are retained; legacy rows are made inactive rather than deleted.
-- Workbook portal usernames/passwords are intentionally not stored.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'insurance_companies_segment_check') then
    alter table public.insurance_companies
      add constraint insurance_companies_segment_check
      check (segment is null or segment in ('general', 'life', 'health'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'insurance_companies_portal_status_check') then
    alter table public.insurance_companies
      add constraint insurance_companies_portal_status_check
      check (portal_status in ('configured', 'pending', 'not_provided'));
  end if;
end $$;

create index if not exists insurance_companies_active_segment_name_idx
  on public.insurance_companies (is_active, segment, name);

update public.insurance_companies
set is_active = false,
    updated_at = now();

insert into public.insurance_companies (
  name, segment, sibpl_code, portal_url, portal_status, is_active, updated_at
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
