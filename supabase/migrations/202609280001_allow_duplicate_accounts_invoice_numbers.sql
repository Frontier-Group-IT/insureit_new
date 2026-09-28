-- Accounts reconciliation may allocate one insurer bill/invoice number across
-- multiple policy rows. Bill number is business reference data, not a globally
-- unique transaction identifier.

DROP INDEX IF EXISTS public.accounts_invoices_invoice_no_uidx;

-- Preserve efficient case-insensitive bill-number lookup without enforcing
-- uniqueness. Transaction/idempotency protection remains independent of the
-- human-entered bill number.
CREATE INDEX IF NOT EXISTS accounts_invoices_invoice_no_idx
  ON public.accounts_invoices (upper(btrim(invoice_no)))
  WHERE invoice_no IS NOT NULL AND btrim(invoice_no) <> '';

COMMENT ON INDEX public.accounts_invoices_invoice_no_idx IS
  'Non-unique lookup index: one insurer bill/invoice number may legitimately be allocated across multiple policy reconciliation entries.';
