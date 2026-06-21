-- Allow the claim desk to remove an unsuitable uploaded document before adding
-- a replacement for the same required document type.
drop policy if exists "claim documents manager delete" on public.claim_documents;

create policy "claim documents manager delete"
on public.claim_documents for delete
to authenticated
using (
  public.current_app_role() in ('manager', 'claim_processor', 'admin', 'super_admin')
  or public.can_access_full_business_data()
);
drop policy if exists "claim document objects manager delete" on storage.objects;

create policy "claim document objects manager delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'claim-documents'
  and public.current_app_role() in ('manager', 'claim_processor', 'admin', 'super_admin')
  and exists (
    select 1
    from public.claim_documents cd
    where cd.storage_path = storage.objects.name
      and public.can_access_claim(auth.uid(), cd.claim_id)
  )
);