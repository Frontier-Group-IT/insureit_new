-- Reversal for PREPARED migration 20261016150000.
-- Run only after reviewing/retaining any administrative evidence externally.
begin;
drop table if exists public.customer_firebase_migration_audit;
commit;
