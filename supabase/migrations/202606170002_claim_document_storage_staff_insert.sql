create policy "claim document objects hierarchy insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'claim-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.claims c
    where c.customer_id = split_part(storage.objects.name, '/', 1)::uuid
      and c.id = split_part(storage.objects.name, '/', 2)::uuid
      and public.can_access_claim(auth.uid(), c.id)
  )
);
