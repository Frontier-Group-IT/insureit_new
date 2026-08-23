create index if not exists accounts_invoices_cancelled_by_idx
  on public.accounts_invoices (cancelled_by)
  where cancelled_by is not null;
