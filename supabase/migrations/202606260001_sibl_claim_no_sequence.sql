-- Generates claim_no values like SIBL/1000, SIBL/1001, SIBL/1002...
-- Existing claim_no values are not overwritten.

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
  if new.claim_no is null or btrim(new.claim_no) = '' then
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

create unique index if not exists claims_claim_no_unique_idx on public.claims (claim_no);
