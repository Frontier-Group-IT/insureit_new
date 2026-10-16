-- Only run if audit export and retention review have explicitly authorized rollback.
drop trigger if exists partner_deletion_fulfillment_gate_trigger on public.partner_account_deletion_requests;
drop function if exists public.partner_deletion_fulfillment_gate();
drop table if exists public.partner_account_deletion_events;
alter table public.partner_account_deletion_requests
  drop column if exists fulfillment_authorized_by,
  drop column if exists fulfillment_authorized_at,
  drop column if exists identity_verified_at,
  drop column if exists retention_reviewed_at,
  drop column if exists notification_sent_at,
  drop column if exists fulfillment_reference;
