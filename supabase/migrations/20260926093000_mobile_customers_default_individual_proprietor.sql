begin;

-- Customer masters created directly from the Customer mobile app are always
-- Individual / Proprietor unless an operator later deliberately changes the type.
-- Backfill existing direct-app customers that were created before this rule.
update public.customers
set partner_type = 'individual_proprietor',
    updated_at = now()
where creation_channel = 'direct_customer_onboarding'
  and partner_type is null;

-- Enforce the same rule for every future direct Customer App insert, even if a
-- caller bypasses the standard signup RPC. Explicit non-null types are preserved.
create or replace function public.set_direct_customer_onboarding_partner_type()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.creation_channel = 'direct_customer_onboarding'
     and new.partner_type is null then
    new.partner_type := 'individual_proprietor';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_direct_customer_onboarding_partner_type on public.customers;
create trigger trg_set_direct_customer_onboarding_partner_type
before insert or update of creation_channel, partner_type
on public.customers
for each row
execute function public.set_direct_customer_onboarding_partner_type();

commit;
