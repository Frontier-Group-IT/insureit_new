-- SEC-PR-02 review-only inverse script, NOT an automatic Supabase migration.
-- WARNING: running this without a compensating control REOPENS the original
-- verified broker-managed evidence deletion risk. Claims/Legal sign-off required.
-- Run only in approved isolated synthetic restore rehearsal first.
begin;
drop policy if exists "sec pr 02 protect verified broker claim evidence" on storage.objects;
drop policy if exists "sec pr 02 protect verified broker claim metadata" on public.claim_documents;
drop function if exists vapt_private.sec_pr_02_is_verified_broker_claim_evidence(text,text);
-- Intentionally preserve vapt_private schema and any unrelated objects.
commit;
