-- Read-only contract verification. True row-level behavior must be tested with an authorized branch session.
do $$
declare
  policies_def text;
  summary_def text;
  scope_def text;
begin
  select pg_get_functiondef('public.partner_app_list_policies(integer,integer,text,text)'::regprocedure) into policies_def;
  select pg_get_functiondef('public.partner_app_policy_summary()'::regprocedure) into summary_def;
  select pg_get_functiondef('public.partner_app_commercial_scope()'::regprocedure) into scope_def;
  if position('scoped_partner.partner_code' in policies_def) = 0
    or position('scoped_partner.partner_code' in summary_def) = 0
    or position('child.parent_partner_id' in scope_def) = 0 then
    raise exception 'Partner branch policy scope is not fully installed';
  end if;
end;
$$;
