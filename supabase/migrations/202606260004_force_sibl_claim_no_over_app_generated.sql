-- Force new claim_no values to SIBL/1000, SIBL/1001, SIBL/1002...
-- This also overrides application-generated values like CLM-YYYYMMDD-00000.
-- Existing rows are not changed.

create sequence if not exists public.sibl_claim_no_seq start with 1000 increment by 1;

do $$
declare
  max_existing integer;
begin
  select coalesce(max((substring(claim_no from '^SIBL/([0-9]+)$'))::integer), 999)
    into max_existing
  from public.claims
  where claim_no ~ '^SIBL/[0-9]+$';

  if max_existing >= 1000 then
    perform setval('public.sibl_claim_no_seq', max_existing, true);
  end if;
end $$;

create or replace function public.generate_sibl_claim_no()
returns trigger
language plpgsql
as $$
begin
  if new.claim_no is null
     or btrim(new.claim_no) = ''
     or new.claim_no ~ '^CLM-[0-9]{8}-[0-9]+$'
     or new.claim_no ~ '^CLM-[0-9]{8}-[0-9]{5,}$' then
    new.claim_no := 'SIBL/' || lpad(nextval('public.sibl_claim_no_seq')::text, 4, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generate_sibl_claim_no on public.claims;

create trigger trg_generate_sibl_claim_no
before insert on public.claims
for each row
execute function public.generate_sibl_claim_no();
