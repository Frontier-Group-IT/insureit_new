-- external_claim_customer_completed_stage is an internal helper for the server-side
-- external claim synchronization path. It should not be a directly callable signed-in RPC.

begin;

revoke all on function public.external_claim_customer_completed_stage(uuid)
  from public, anon, authenticated;
grant execute on function public.external_claim_customer_completed_stage(uuid)
  to service_role;

commit;
