begin;

alter table if exists public.intermediaries
  add column if not exists registration_status text;

update public.intermediaries
set registration_status = coalesce(
  registration_status,
  case
    when account_status = 'active' then 'active'
    else account_status
  end
)
where registration_status is null;

commit;
