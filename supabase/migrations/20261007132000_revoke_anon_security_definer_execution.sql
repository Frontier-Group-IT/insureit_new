-- Remove implicit anonymous exposure from all public SECURITY DEFINER functions.
-- Authenticated grants are intentionally preserved for RLS helpers and signed-in client RPCs.
-- Service-role execution is explicitly preserved for server-only workflows.

begin;

do $$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', function_row.signature);
    execute format('grant execute on function %s to service_role', function_row.signature);
  end loop;
end;
$$;

-- Security-by-default for functions created later by postgres in public.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

commit;
