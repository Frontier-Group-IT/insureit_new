begin;

-- Compatibility placeholder.
-- The exact sync_partner_intermediary(uuid) signature is now dropped and
-- recreated inside the following migration's single transaction. Keeping the
-- operations together prevents a failed follow-up migration from leaving the
-- production database without the synchronization function.

commit;
