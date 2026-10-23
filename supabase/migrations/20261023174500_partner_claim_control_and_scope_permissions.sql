-- OTA-safe Partner claims: preserve existing authorization and generate real control numbers.
-- Long CLM timestamps from partner_app_create_claim must be mapped at insert,
-- and the three existing generated identifiers must be reconciled.
begin;

create or replace function public.generate_claim_control_no()
returns trigger language plpgsql
set search_path to 'public'
as $function$
begin
  if new.policy_service_source = 'external'::public.policy_service_source then
    if new.claim_no is null or btrim(new.claim_no) = ''
       or new.claim_no !~ '^EXT/[0-9]+$' then
      new.claim_no := 'EXT/' || lpad(nextval('public.external_claim_no_seq')::text, 4, '0');
    end if;
  else
    if new.claim_no is null or btrim(new.claim_no) = ''
       or new.claim_no ~ '^CLM-[0-9]{8,}-[0-9]+$' then
      new.claim_no := 'SIBL/' || lpad(nextval('public.sibl_claim_no_seq')::text, 4, '0');
    end if;
  end if;
  return new;
end;
$function$;

-- Backfill only machine-generated CLM identifiers; preserve all named control numbers.
with pending as (
  select id from public.claims
  where policy_service_source is distinct from 'external'::public.policy_service_source
    and claim_no ~ '^CLM-[0-9]{8,}-[0-9]+$'
  order by created_at,id
  for update
), numbered as (
  select id,'SIBL/' || lpad(nextval('public.sibl_claim_no_seq')::text, 4, '0') as new_control_no
  from pending
)
update public.claims c set claim_no=n.new_control_no
from numbered n where c.id=n.id;

-- Storage RLS checks this existing scope predicate under authenticated role.
-- Grant ONLY function invocation, never direct bypass of claim ownership checks.
revoke execute on function public.partner_app_claim_in_scope(uuid) from public,anon;
grant execute on function public.partner_app_claim_in_scope(uuid) to authenticated,service_role;

commit;
