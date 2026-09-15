do $$
declare
  v_context text := pg_get_functiondef('public.partner_portal_access_context()'::regprocedure);
  v_scope text := pg_get_functiondef('public.partner_app_commercial_scope()'::regprocedure);
  v_intake_identity text := pg_get_functiondef('public.partner_policy_intake_current_identity()'::regprocedure);
begin
  if position('pr.is_active = true' in v_context) = 0 then
    raise exception 'partner_portal_access_context must revalidate profile activity';
  end if;
  if position('g.status = ''active''' in v_context) = 0 then
    raise exception 'partner_portal_access_context must revalidate Group activity';
  end if;
  if position('p.partner_status = ''active_partner''' in v_context) = 0 then
    raise exception 'partner_portal_access_context must revalidate Branch activity';
  end if;
  if position('coalesce(p.parent_partner_id, p.id)' in v_scope) = 0 then
    raise exception 'commercial scope must resolve Group inheritance through the root Partner';
  end if;
  if position('partner_app_current_identity()' in v_intake_identity) = 0
     or position('''profile_id'', auth.uid()' in v_intake_identity) = 0 then
    raise exception 'Policy Intake identity adapter is incomplete';
  end if;
end $$;

select
  to_regclass('public.portal_access_identities') is not null as access_table_ready,
  to_regprocedure('public.partner_portal_access_context()') is not null as access_context_ready,
  to_regprocedure('public.partner_app_commercial_scope()') is not null as commercial_scope_ready,
  to_regprocedure('public.partner_policy_intake_current_identity()') is not null as policy_intake_identity_ready,
  has_function_privilege('authenticated', 'public.partner_portal_access_context()', 'EXECUTE') as access_context_authenticated,
  has_function_privilege('authenticated', 'public.partner_app_commercial_scope()', 'EXECUTE') as commercial_scope_authenticated,
  has_function_privilege('authenticated', 'public.partner_policy_intake_current_identity()', 'EXECUTE') as intake_identity_authenticated,
  not has_function_privilege('anon', 'public.partner_policy_intake_current_identity()', 'EXECUTE') as intake_identity_anon_blocked;

-- Existing Policy Intake ownership contract is deliberately reused: explicit
-- Group/Branch portal identities submit through profiles; legacy Partner
-- identities continue through intermediary_portal_accounts.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
  'public.policy_intake_requests'::regclass,
  'public.policy_intake_documents'::regclass
)
  and conname in (
    'policy_intake_requests_submitter_check',
    'policy_intake_documents_uploader_check'
  )
order by conname;
