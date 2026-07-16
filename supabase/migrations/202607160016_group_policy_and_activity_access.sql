-- Let Group parent accounts create policies for accessible child customers and
-- read child customer activity in the mobile portfolio.

create or replace function public.create_customer_policy(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_insurance_company_id uuid,
  p_policy_no text,
  p_policy_type text,
  p_start_date date,
  p_end_date date,
  p_premium_amount numeric default null
)
returns public.policies
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.policies;
  cleaned_policy_no text := upper(nullif(btrim(coalesce(p_policy_no, '')), ''));
  cleaned_policy_type text := nullif(btrim(coalesce(p_policy_type, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_customer_id is null or not public.can_access_customer(p_customer_id) then
    raise exception 'You do not have access to add policies for this customer.';
  end if;

  if cleaned_policy_no is null then
    raise exception 'Policy number is required.';
  end if;

  if cleaned_policy_type is null then
    raise exception 'Policy type is required.';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Enter a valid policy start and end date.';
  end if;

  if p_premium_amount is not null and p_premium_amount < 0 then
    raise exception 'Premium amount cannot be negative.';
  end if;

  if not exists (
    select 1
    from public.vehicles vehicle
    where vehicle.id = p_vehicle_id
      and vehicle.customer_id = p_customer_id
  ) then
    raise exception 'Select a valid vehicle for this customer.';
  end if;

  if not exists (
    select 1
    from public.insurance_companies company
    where company.id = p_insurance_company_id
  ) then
    raise exception 'Select a valid insurer.';
  end if;

  insert into public.policies (
    customer_id,
    vehicle_id,
    insurance_company_id,
    policy_no,
    policy_type,
    start_date,
    end_date,
    premium_amount
  ) values (
    p_customer_id,
    p_vehicle_id,
    p_insurance_company_id,
    cleaned_policy_no,
    cleaned_policy_type,
    p_start_date,
    p_end_date,
    p_premium_amount
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.create_customer_policy(uuid, uuid, uuid, text, text, date, date, numeric) from public;
grant execute on function public.create_customer_policy(uuid, uuid, uuid, text, text, date, date, numeric) to authenticated;

drop policy if exists customer_activity_events_read_accessible_customer on public.customer_activity_events;
create policy customer_activity_events_read_accessible_customer
on public.customer_activity_events for select
to authenticated
using (public.can_access_customer(customer_id));
