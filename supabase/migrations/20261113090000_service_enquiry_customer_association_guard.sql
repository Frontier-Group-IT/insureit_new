-- SEC-PR-06 / VAPT-2026-004. DRAFT ONLY: DO NOT APPLY TO PRODUCTION.
-- This changes only customer-originated INSERT association checks.
-- Staff SELECT/UPDATE and unassociated customer enquiries remain unchanged.
-- Before release: confirm Support's linked-account association rules and test in isolation.
begin;
drop policy if exists "service enquiries customer create own" on public.service_enquiries;
create policy "service enquiries customer create own"
on public.service_enquiries for insert to authenticated
with check (
  created_by = auth.uid()
  and customer_id in (
    select c.id from public.customers c where c.profile_id = auth.uid()
  )
  and source = 'customer_dashboard'
  and guest_name is null and guest_phone is null and guest_email is null
  and (
    vehicle_id is null
    or exists (
      select 1 from public.vehicles v
      where v.id = service_enquiries.vehicle_id
        and v.customer_id = service_enquiries.customer_id
    )
  )
  and (
    claim_id is null
    or exists (
      select 1 from public.claims cl
      where cl.id = service_enquiries.claim_id
        and cl.customer_id = service_enquiries.customer_id
    )
  )
);
commit;
