-- Allow customers to permanently delete claim documents that belong to their own claims.
-- This is intentionally scoped to the customer role and the customer's own claim/customer path.

drop policy if exists "claim documents customer delete own claim" on public.claim_documents;

create policy "claim documents customer delete own claim"
on public.claim_documents
for delete
to authenticated
using (
  public.current_app_role() = 'customer'
  and customer_id in (
    select id
    from public.customers
    where profile_id = auth.uid()
  )
  and exists (
    select 1
    from public.claims claim
    where claim.id = claim_documents.claim_id
      and claim.customer_id = claim_documents.customer_id
  )
);

drop policy if exists "claim document objects customer delete own claim" on storage.objects;

create policy "claim document objects customer delete own claim"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'claim-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.customers customer
    join public.claims claim on claim.customer_id = customer.id
    where customer.profile_id = auth.uid()
      and customer.id = split_part(storage.objects.name, '/', 1)::uuid
      and claim.id = split_part(storage.objects.name, '/', 2)::uuid
  )
);
