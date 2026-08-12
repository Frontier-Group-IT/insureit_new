-- Generate control numbers by explicit policy service source.
-- Existing claims are untouched. Unknown/SIBL source keeps the existing SIBL sequence behavior.

create sequence if not exists public.external_claim_no_seq start with 1000 increment by 1;

do $$
declare
  max_existing integer;
begin
  select coalesce(max((substring(claim_no from '^EXT/([0-9]+)$'))::integer), 999)
    into max_existing
  from public.claims
  where claim_no ~ '^EXT/[0-9]+$';

  if max_existing >= 1000 then
    perform setval('public.external_claim_no_seq', max_existing, true);
  end if;
end $$;

create or replace function public.generate_claim_control_no()
returns trigger
language plpgsql
as $$
begin
  if new.policy_service_source = 'external'::public.policy_service_source then
    if new.claim_no is null
       or btrim(new.claim_no) = ''
       or new.claim_no !~ '^EXT/[0-9]+$' then
      new.claim_no := 'EXT/' || lpad(nextval('public.external_claim_no_seq')::text, 4, '0');
    end if;
  else
    if new.claim_no is null
       or btrim(new.claim_no) = ''
       or new.claim_no ~ '^CLM-[0-9]{8}-[0-9]+$'
       or new.claim_no ~ '^CLM-[0-9]{8}-[0-9]{5,}$' then
      new.claim_no := 'SIBL/' || lpad(nextval('public.sibl_claim_no_seq')::text, 4, '0');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_generate_sibl_claim_no on public.claims;
drop trigger if exists trg_generate_claim_control_no on public.claims;

create trigger trg_generate_claim_control_no
before insert on public.claims
for each row
execute function public.generate_claim_control_no();
