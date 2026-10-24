-- Remove only pending, self-uploaded documents from a Partner-scoped claim.
-- Applied separately after PR approval; never run automatically from a mobile client.
create or replace function public.partner_app_remove_claim_document(
  p_claim_id uuid,
  p_document_id uuid
) returns text
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_storage_path text;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode = '42501';
  end if;

  delete from public.claim_documents d
  where d.id = p_document_id
    and d.claim_id = p_claim_id
    and d.uploaded_by = auth.uid()
    and d.verification_status = 'pending'
    and d.storage_bucket = 'claim-documents'
  returning d.storage_path into v_storage_path;

  if v_storage_path is null then
    raise exception 'Document cannot be deleted or is not available in your account' using errcode = '42501';
  end if;

  return v_storage_path;
end;
$fn$;
revoke all on function public.partner_app_remove_claim_document(uuid,uuid) from public, anon;
grant execute on function public.partner_app_remove_claim_document(uuid,uuid) to authenticated, service_role;

-- Permit cleanup of own Partner claim storage objects only; the database RPC above
-- is the sole path for removing the linked metadata.
drop policy if exists "partner claim document scoped delete" on storage.objects;
create policy "partner claim document scoped delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'claim-documents'
  and owner_id = auth.uid()::text
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.claims c
    where c.customer_id = split_part(storage.objects.name, '/', 1)::uuid
      and c.id = split_part(storage.objects.name, '/', 2)::uuid
      and public.partner_app_claim_in_scope(c.id)
  )
);
