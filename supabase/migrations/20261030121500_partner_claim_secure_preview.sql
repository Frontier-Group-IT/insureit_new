-- Provide read-only, claim-scoped previews without exposing public storage URLs.
-- Deploy this migration before enabling the Partner App preview action.
create or replace function public.partner_app_claim_document_preview_path(
  p_claim_id uuid,
  p_document_id uuid
) returns text
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare v_path text;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode = '42501';
  end if;
  select d.storage_path into v_path
  from public.claim_documents d
  where d.claim_id = p_claim_id
    and d.id = p_document_id
    and d.storage_bucket = 'claim-documents';
  if v_path is null then
    raise exception 'Document not available in your Partner scope' using errcode = '42501';
  end if;
  return v_path;
end;
$fn$;
revoke all on function public.partner_app_claim_document_preview_path(uuid,uuid) from public, anon;
grant execute on function public.partner_app_claim_document_preview_path(uuid,uuid) to authenticated, service_role;

-- Signed URL creation needs SELECT on the private storage object.
-- Require BOTH a permitted claim and a matching metadata row, not merely a guessed path.
drop policy if exists "partner scoped claim document preview" on storage.objects;
create policy "partner scoped claim document preview"
on storage.objects for select to authenticated
using (
  bucket_id = 'claim-documents'
  and exists (
    select 1 from public.claim_documents d
    where d.storage_bucket = 'claim-documents'
      and d.storage_path = storage.objects.name
      and public.partner_app_claim_in_scope(d.claim_id)
  )
);
