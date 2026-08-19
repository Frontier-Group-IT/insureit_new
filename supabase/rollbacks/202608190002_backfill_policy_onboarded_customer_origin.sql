begin;

-- Revert only customers classified by the dedicated historical backfill.
-- Audit history remains append-only and is deliberately not deleted.
-- The provenance guard is disabled only for this targeted rollback because it
-- normally prevents any known creation source from being rewritten.

alter table public.customers disable trigger protect_customer_creation_provenance;

update public.customers c
set
  creation_channel = 'legacy',
  origin_customer_id = null
where c.creation_channel = 'policy_onboarding'
  and exists (
    select 1
    from public.audit_logs a
    where a.table_name = 'customers'
      and a.record_id = c.id
      and a.action = 'customer_creation_origin_backfilled'
      and a.new_data ->> 'creation_channel' = 'policy_onboarding'
  );

alter table public.customers enable trigger protect_customer_creation_provenance;

commit;
