-- Canonicalize Indian customer mobile numbers so customer matching and policy
-- onboarding treat +91XXXXXXXXXX, 0XXXXXXXXXX and XXXXXXXXXX consistently.

create or replace function public.normalize_indian_mobile(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  with normalized as (
    select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as digits
  )
  select case
    when digits ~ '^91[6-9][0-9]{9}$' then right(digits, 10)
    when digits ~ '^0[6-9][0-9]{9}$' then right(digits, 10)
    else digits
  end
  from normalized;
$$;

create or replace function public.normalize_customer_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.phone is not null then
    new.phone := public.normalize_indian_mobile(new.phone);
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_customer_phone_trg on public.customers;
create trigger normalize_customer_phone_trg
before insert or update of phone on public.customers
for each row
execute function public.normalize_customer_phone();

-- Repair historical rows so indexed equality lookups by phone use the same
-- canonical 10-digit value as policy onboarding.
update public.customers
set phone = public.normalize_indian_mobile(phone)
where phone is distinct from public.normalize_indian_mobile(phone);

-- Harden the existing policy RPC without duplicating its large implementation.
-- This guarded patch preserves every other line of the currently canonical RPC.
do $migration$
declare
  v_definition text;
  v_phone_assignment_old constant text := $old$v_phone := regexp_replace(coalesce(p_payload #>> '{customer,phone}', ''), '[^0-9]', '', 'g');$old$;
  v_phone_assignment_new constant text := $new$v_phone := public.normalize_indian_mobile(coalesce(p_payload #>> '{customer,phone}', ''));$new$;
  v_phone_validation_old constant text := $old$if v_name = '' or length(v_phone) <> 10 then$old$;
  v_phone_validation_new constant text := $new$if v_name = '' or v_phone !~ '^[6-9][0-9]{9}$' then$new$;
begin
  select pg_get_functiondef('public.onboard_motor_policy(jsonb)'::regprocedure)
  into v_definition;

  if position(v_phone_assignment_old in v_definition) = 0 then
    raise exception 'Expected onboard_motor_policy phone normalization statement was not found; migration aborted safely.';
  end if;

  if position(v_phone_validation_old in v_definition) = 0 then
    raise exception 'Expected onboard_motor_policy phone validation statement was not found; migration aborted safely.';
  end if;

  v_definition := replace(v_definition, v_phone_assignment_old, v_phone_assignment_new);
  v_definition := replace(v_definition, v_phone_validation_old, v_phone_validation_new);
  execute v_definition;
end;
$migration$;
