create or replace function public.guard_closed_accounting_date() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  v_date date;
  v_row jsonb;
begin
  v_row := to_jsonb(NEW);
  v_date := nullif(v_row ->> TG_ARGV[0], '')::date;
  if v_date is not null and public.accounting_date_is_closed(v_date) then
    raise exception 'Accounting period is closed for %', v_date;
  end if;
  return NEW;
end $$;
