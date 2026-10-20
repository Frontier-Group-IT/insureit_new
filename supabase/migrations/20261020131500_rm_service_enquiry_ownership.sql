-- RM ticket isolation; reversible using accompanying rollback.
-- Unassigned enquiries stay visible to operational administrators for assignment.
-- Only existing explicit assigned_to UUID authorizes an RM. No inference from guest/customer.
create index if not exists service_enquiries_assigned_to_created_idx on public.service_enquiries (assigned_to,created_at desc);

drop policy if exists "service enquiries customer select own" on public.service_enquiries;
create policy "service enquiries customer select own" on public.service_enquiries for select to authenticated using (
 customer_id in (select c.id from public.customers c where c.profile_id=auth.uid())
 or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive')
 or (public.current_app_role()='relationship_manager' and assigned_to=auth.uid())
);

drop policy if exists "service enquiries operations update" on public.service_enquiries;
create policy "service enquiries operations update" on public.service_enquiries for update to authenticated
using (public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive') or (public.current_app_role()='relationship_manager' and assigned_to=auth.uid()))
with check (public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive') or (public.current_app_role()='relationship_manager' and assigned_to=auth.uid()));

drop policy if exists "service enquiry messages members select" on public.service_enquiry_messages;
create policy "service enquiry messages members select" on public.service_enquiry_messages for select to authenticated
using (exists (select 1 from public.service_enquiries se where se.id=enquiry_id and (se.customer_id in (select c.id from public.customers c where c.profile_id=auth.uid()) or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive') or (public.current_app_role()='relationship_manager' and se.assigned_to=auth.uid()))));

drop policy if exists "service enquiry messages members create" on public.service_enquiry_messages;
create policy "service enquiry messages members create" on public.service_enquiry_messages for insert to authenticated
with check (sender_id=auth.uid() and exists (select 1 from public.service_enquiries se where se.id=enquiry_id and (se.customer_id in (select c.id from public.customers c where c.profile_id=auth.uid()) or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive') or (public.current_app_role()='relationship_manager' and se.assigned_to=auth.uid()))));

drop policy if exists "service enquiry attachments members select" on public.service_enquiry_attachments;
create policy "service enquiry attachments members select" on public.service_enquiry_attachments for select to authenticated
using (exists (select 1 from public.service_enquiries se where se.id=enquiry_id and (se.customer_id in (select c.id from public.customers c where c.profile_id=auth.uid()) or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive') or (public.current_app_role()='relationship_manager' and se.assigned_to=auth.uid()))));
