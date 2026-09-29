-- Keep Life/Health policy reporting classification aligned with the canonical business line.
-- business_type is also used for lifecycle values such as New, so Life/Health must not
-- leak those values into the Business Mix report.

update public.policies
set business_type = 'Life'
where lower(trim(coalesce(business_line, ''))) = 'life'
  and business_type is distinct from 'Life';

update public.policies
set business_type = 'Health'
where lower(trim(coalesce(business_line, ''))) = 'health'
  and business_type is distinct from 'Health';
