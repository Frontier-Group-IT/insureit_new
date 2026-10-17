-- Reverse ONLY the prepared enrollment RPC, after reviewing migration dependencies.
begin;
drop function if exists public.customer_firebase_enroll_approved(uuid,text,text,uuid,text);
commit;
