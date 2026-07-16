-- Allow Group parent accounts to create operational records for linked child customers.
-- The checks keep vehicle, policy and claim ownership tied to the selected accessible customer.

drop policy if exists vehicles_insert_accessible_customer on public.vehicles;
create policy vehicles_insert_accessible_customer
on public.vehicles for insert
to authenticated
with check (public.can_access_customer(customer_id));

drop policy if exists policies_insert_accessible_customer on public.policies;
create policy policies_insert_accessible_customer
on public.policies for insert
to authenticated
with check (
  public.can_access_customer(customer_id)
  and exists (
    select 1
    from public.vehicles vehicle
    where vehicle.id = policies.vehicle_id
      and vehicle.customer_id = policies.customer_id
  )
);

drop policy if exists claims_insert_accessible_customer on public.claims;
create policy claims_insert_accessible_customer
on public.claims for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.can_access_customer(customer_id)
  and exists (
    select 1
    from public.vehicles vehicle
    where vehicle.id = claims.vehicle_id
      and vehicle.customer_id = claims.customer_id
  )
  and exists (
    select 1
    from public.policies policy
    where policy.id = claims.policy_id
      and policy.customer_id = claims.customer_id
      and policy.vehicle_id = claims.vehicle_id
  )
);

drop policy if exists claims_update_accessible_customer on public.claims;
create policy claims_update_accessible_customer
on public.claims for update
to authenticated
using (public.can_access_customer(customer_id))
with check (public.can_access_customer(customer_id));

drop policy if exists claim_documents_insert_accessible_customer on public.claim_documents;
create policy claim_documents_insert_accessible_customer
on public.claim_documents for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_access_customer(customer_id)
  and exists (
    select 1
    from public.claims claim
    where claim.id = claim_documents.claim_id
      and claim.customer_id = claim_documents.customer_id
  )
);

drop policy if exists claim_status_history_insert_accessible_customer on public.claim_status_history;
create policy claim_status_history_insert_accessible_customer
on public.claim_status_history for insert
to authenticated
with check (
  changed_by = auth.uid()
  and exists (
    select 1
    from public.claims claim
    where claim.id = claim_status_history.claim_id
      and public.can_access_customer(claim.customer_id)
  )
);

drop policy if exists claim_document_objects_read_accessible_customer on storage.objects;
create policy claim_document_objects_read_accessible_customer
on storage.objects for select
to authenticated
using (
  bucket_id = 'claim-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_customer(split_part(name, '/', 1)::uuid)
);

drop policy if exists claim_document_objects_insert_accessible_customer on storage.objects;
create policy claim_document_objects_insert_accessible_customer
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'claim-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.claims claim
    where claim.customer_id = split_part(storage.objects.name, '/', 1)::uuid
      and claim.id = split_part(storage.objects.name, '/', 2)::uuid
      and public.can_access_customer(claim.customer_id)
  )
);
