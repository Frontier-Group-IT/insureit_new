-- Remove signed-in Data API access to low-level internal identity/synchronization
-- primitives. Their higher-level guarded workflows and trigger callers remain unchanged.

begin;

revoke all on function public.generate_customer_signup_code()
  from public, anon, authenticated;
grant execute on function public.generate_customer_signup_code()
  to service_role;

revoke all on function public.next_partner_application_reference()
  from public, anon, authenticated;
grant execute on function public.next_partner_application_reference()
  to service_role;

revoke all on function public.next_partner_code()
  from public, anon, authenticated;
grant execute on function public.next_partner_code()
  to service_role;

revoke all on function public.next_partner_identity()
  from public, anon, authenticated;
grant execute on function public.next_partner_identity()
  to service_role;

revoke all on function public.next_posp_identity()
  from public, anon, authenticated;
grant execute on function public.next_posp_identity()
  to service_role;

revoke all on function public.next_registration_code(text)
  from public, anon, authenticated;
grant execute on function public.next_registration_code(text)
  to service_role;

revoke all on function public.sync_partner_details_to_linked_accounts(uuid)
  from public, anon, authenticated;
grant execute on function public.sync_partner_details_to_linked_accounts(uuid)
  to service_role;

revoke all on function public.sync_partner_identity_to_intermediary_register(uuid)
  from public, anon, authenticated;
grant execute on function public.sync_partner_identity_to_intermediary_register(uuid)
  to service_role;

commit;
