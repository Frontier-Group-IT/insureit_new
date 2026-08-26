-- Preserve trusted server/service-role behavior after making profiles.role authoritative
-- for normal authenticated users. Service-role JWTs already bypass RLS and are used only
-- by server-only code, so mapping that trusted database caller to super_admin prevents
-- existing SECURITY DEFINER helpers from accidentally treating server calls as customers.

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(
      auth.jwt() ->> 'role',
      current_setting('request.jwt.claim.role', true),
      ''
    ) = 'service_role'
      then 'super_admin'::public.app_role
    else coalesce(
      (
        select profile.role
        from public.profiles as profile
        where profile.id = auth.uid()
          and profile.is_active
      ),
      'customer'::public.app_role
    )
  end;
$$;

comment on function public.current_app_role() is
  'Returns active profiles.role for authenticated users, trusted super_admin semantics for the server-only service role, and never trusts user-editable JWT metadata for authorization.';
