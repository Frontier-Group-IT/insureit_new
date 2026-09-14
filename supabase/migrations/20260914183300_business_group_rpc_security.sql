-- Keep business Group mutation RPCs server-only, matching the existing
-- intermediary Group service-RPC privilege model.
--
-- This file is the final activation marker for the production rollout. The
-- application remains on the legacy Group workspace until this migration has
-- completed successfully.

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

create or replace function public.business_group_hierarchy_schema_ready()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'intermediary_groups'
        and column_name = 'group_mode'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'partners'
        and column_name = 'parent_partner_id'
    )
    and to_regprocedure('public.service_create_business_intermediary_group(text,text,uuid[],uuid)') is not null
    and to_regprocedure('public.service_assign_business_intermediary_group_members(uuid,uuid[],uuid,text)') is not null
    and to_regprocedure('public.service_assign_partner_branch(uuid,uuid,uuid)') is not null
    and to_regprocedure('public.service_remove_partner_branch(uuid,uuid)') is not null
    and to_regprocedure('public.service_revert_business_intermediary_group_to_legacy(uuid,uuid,uuid,text)') is not null;
$function$;

revoke execute on function public.business_group_hierarchy_schema_ready() from public, anon, authenticated;
grant execute on function public.business_group_hierarchy_schema_ready() to service_role;
