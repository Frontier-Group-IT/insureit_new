-- Keep canonical insurer names aligned to current registered/legal wording.
-- This correction is deliberately non-destructive: UUIDs and all policy/claim/surveyor FKs stay unchanged.

update public.insurance_companies
set name = 'Royal Sundaram General Insurance Co. Limited',
    updated_at = now()
where name = 'Royal Sundaram General Insurance Company Limited';

update public.insurance_companies
set name = 'Bandhan Life Insurance Limited',
    updated_at = now()
where name = 'Bandhan Life Insurance Company Limited';

update public.insurance_companies
set name = 'Pramerica Life Insurance Limited',
    updated_at = now()
where name = 'Pramerica Life Insurance Company Limited';

-- Preserve the old/short wording as aliases so historical imports and OCR/search still resolve.
insert into public.insurance_company_aliases (insurance_company_id, alias, source)
select c.id, v.alias, v.source
from public.insurance_companies c
join (values
  ('Royal Sundaram General Insurance Co. Limited', 'Royal Sundaram General Insurance Company Limited', 'name_correction'),
  ('Bandhan Life Insurance Limited', 'Bandhan Life Insurance Company Limited', 'name_correction'),
  ('Pramerica Life Insurance Limited', 'Pramerica Life Insurance Company Limited', 'name_correction')
) as v(company_name, alias, source)
  on c.name = v.company_name
on conflict do nothing;
