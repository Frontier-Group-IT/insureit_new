-- Keep business Group mutation RPCs server-only, matching the existing
-- intermediary Group service-RPC privilege model.

revoke execute on function public.service_create_business_intermediary_group(text, text, uuid[], uuid) from public, anon, authenticated;
revoke execute on function public.service_assign_business_intermediary_group_members(uuid, uuid[], uuid, text) from public, anon, authenticated;
revoke execute on function public.service_convert_intermediary_group_to_business(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.service_assign_partner_branch(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.service_remove_partner_branch(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.service_revert_business_intermediary_group_to_legacy(uuid, uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.service_create_business_intermediary_group(text, text, uuid[], uuid) to service_role;
grant execute on function public.service_assign_business_intermediary_group_members(uuid, uuid[], uuid, text) to service_role;
grant execute on function public.service_convert_intermediary_group_to_business(uuid, uuid) to service_role;
grant execute on function public.service_assign_partner_branch(uuid, uuid, uuid) to service_role;
grant execute on function public.service_remove_partner_branch(uuid, uuid) to service_role;
grant execute on function public.service_revert_business_intermediary_group_to_legacy(uuid, uuid, uuid, text) to service_role;
