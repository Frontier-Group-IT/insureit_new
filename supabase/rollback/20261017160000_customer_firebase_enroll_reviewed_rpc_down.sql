-- SOURCE-ONLY, DATA-PRESERVING DEACTIVATION. Not an automated deployment.
begin;
revoke all on function public.customer_firebase_enroll_reviewed(uuid,text,text,uuid,text)
 from public, anon, authenticated, service_role;
drop function if exists public.customer_firebase_enroll_reviewed(uuid,text,text,uuid,text);
-- Do not regrant the older broad enrollment RPC to the service role here.
-- The operator must separately review any restoration of earlier privileges.
-- Preserve all Customer/Auth rows, Firebase links and append-only audit history.
commit;
