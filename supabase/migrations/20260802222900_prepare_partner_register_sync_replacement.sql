begin;

-- PostgreSQL does not allow CREATE OR REPLACE FUNCTION to change a function's
-- return type. Some deployed environments contain an earlier
-- sync_partner_intermediary(uuid) definition with a different return type.
-- Drop only this exact signature so the following migration can recreate the
-- corrected parent-only synchronizer. Do not use CASCADE: the profile trigger
-- executes handle_partner_profile_sync(), which remains in place and resolves
-- sync_partner_intermediary(uuid) when it runs after the replacement exists.
drop function if exists public.sync_partner_intermediary(uuid);

commit;
