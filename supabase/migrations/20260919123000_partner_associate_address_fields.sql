begin;

alter table public.partner_portal_associate_accounts
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists postal_code text;

commit;
