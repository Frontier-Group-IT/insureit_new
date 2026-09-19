begin;

alter table public.partner_portal_associate_accounts
  drop column if exists postal_code,
  drop column if exists state,
  drop column if exists city,
  drop column if exists address;

commit;
