-- The original policy-backed self-managed claim RPC predates explicit policy
-- service-source enforcement and can accept any customer policy. The production
-- mobile flow now uses create_self_managed_policy_claim(), which requires
-- policy_service_source='external'. Retain the legacy function for migration
-- history/service-role recovery, but remove direct authenticated client access.

revoke all on function public.create_self_managed_claim(
  uuid, uuid, uuid, uuid, timestamptz, text, text, text
) from public;

revoke all on function public.create_self_managed_claim(
  uuid, uuid, uuid, uuid, timestamptz, text, text, text
) from anon;

revoke all on function public.create_self_managed_claim(
  uuid, uuid, uuid, uuid, timestamptz, text, text, text
) from authenticated;
