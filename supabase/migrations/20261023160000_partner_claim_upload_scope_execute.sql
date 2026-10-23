-- Scoped claim uploads call partner_app_claim_in_scope(uuid) from storage RLS.
-- Restore EXECUTE only for authenticated callers; the predicate's existing
-- authorization checks remain unchanged, and anon/public remain revoked.
begin;
do $$
begin
  if to_regprocedure('public.partner_app_claim_in_scope(uuid)') is null then
    raise exception 'Expected scoped Partner claim predicate is missing';
  end if;
end $$;
revoke execute on function public.partner_app_claim_in_scope(uuid) from public, anon;
grant execute on function public.partner_app_claim_in_scope(uuid) to authenticated, service_role;
commit;
