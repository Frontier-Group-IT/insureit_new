-- Only for rollback before requests have been submitted or after safely exporting records.
drop table if exists public.partner_account_deletion_requests;
