-- SEC-PR-02 VAPT-2026-005. DRAFT ONLY: DO NOT APPLY.
-- This restrictive guard applies in addition to every permissive DELETE policy.
-- Business review required: verified broker-managed evidence replacement/deletion,
-- self-managed exceptions and document retention rules.
begin;
-- Definer lookup prevents a caller's claim_documents RLS from hiding protected
-- metadata during the Storage DELETE decision.
create schema if not exists vapt_private;
revoke all on schema vapt_private from public;
grant usage on schema vapt_private to authenticated;
create or replace function vapt_private.sec_pr_02_is_verified_broker_claim_evidence(p_bucket text, p_path text)
returns boolean
language sql stable security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.claim_documents cd
    join public.claims c on c.id = cd.claim_id
    where cd.storage_bucket = p_bucket
      and cd.storage_path = p_path
      and cd.verification_status = 'verified'
      and c.claim_service_mode = 'broker_managed'
  );
$fn$;
revoke all on function vapt_private.sec_pr_02_is_verified_broker_claim_evidence(text,text) from public;
grant execute on function vapt_private.sec_pr_02_is_verified_broker_claim_evidence(text,text) to authenticated;

-- A Storage-only guard is not sufficient if the metadata row can first be
-- deleted through an independently permissive claim_documents DELETE policy.
-- This restrictive metadata policy protects the same retained evidence.
create policy "sec pr 02 protect verified broker claim metadata"
on public.claim_documents as restrictive for delete to authenticated
using (
  not vapt_private.sec_pr_02_is_verified_broker_claim_evidence(
    claim_documents.storage_bucket, claim_documents.storage_path
  )
);

create policy "sec pr 02 protect verified broker claim evidence"
on storage.objects as restrictive for delete to authenticated
using (
  bucket_id <> 'claim-documents'
  or not vapt_private.sec_pr_02_is_verified_broker_claim_evidence(bucket_id, name)
);
commit;
