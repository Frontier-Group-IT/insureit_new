-- Permit a customer to create a draft for their own vehicle without a linked policy.
-- An additive INSERT policy does not relax any existing policies and keeps all other
-- rows protected by existing customer and vehicle ownership checks.
begin;
create policy "customer_policyless_claim_draft_insert"
on public.claims
for insert to authenticated
with check (
  (public.current_app_role())::text = 'customer'
  and created_by = auth.uid()
  and customer_id is not null
  and vehicle_id is not null
  and policy_id is null
  and external_policy_id is null
  and current_status = 'Draft'::public.claim_status
  and public.can_access_customer(auth.uid(), customer_id)
  and public.can_access_vehicle(auth.uid(), vehicle_id)
  and exists (
    select 1 from public.vehicles v
    where v.id = vehicle_id and v.customer_id = customer_id
  )
);
commit;
