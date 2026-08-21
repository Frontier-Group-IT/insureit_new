drop trigger if exists vehicles_sync_pending_vehicle_no_from_chassis on public.vehicles;
drop function if exists public.sync_pending_vehicle_no_from_chassis();

-- Data rows repaired by the forward migration are intentionally not reverted:
-- restoring stale PENDING-* identifiers would recreate the production conflict.
