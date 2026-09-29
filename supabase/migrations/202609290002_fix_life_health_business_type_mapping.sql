-- Canonicalize Life/Health reporting classification for existing and future policies.
-- This prevents lifecycle-like values such as "New" from leaking into Business Mix.

update public.policies
set business_type = 'Life'
where lower(trim(coalesce(business_line, ''))) = 'life'
  and business_type is distinct from 'Life';

update public.policies
set business_type = 'Health'
where lower(trim(coalesce(business_line, ''))) = 'health'
  and business_type is distinct from 'Health';

create or replace function public.enforce_life_health_business_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if lower(trim(coalesce(new.business_line, ''))) = 'life' then
    new.business_type := 'Life';
  elsif lower(trim(coalesce(new.business_line, ''))) = 'health' then
    new.business_type := 'Health';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_life_health_business_type on public.policies;
create trigger trg_enforce_life_health_business_type
before insert or update of business_line, business_type on public.policies
for each row
execute function public.enforce_life_health_business_type();
