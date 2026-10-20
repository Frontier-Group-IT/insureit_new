-- Manual emergency rollback ONLY. Never deploy automatically.
-- Restores pre-change permissive policies; do not run unless rollback explicitly approved.
drop policy if exists "service enquiries customer select own" on public.service_enquiries;
create policy "service enquiries customer select own" on public.service_enquiries for select to authenticated using (
 customer_id in (select c.id from public.customers c where c.profile_id=auth.uid())
 or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager')
);
drop policy if exists "service enquiries operations update" on public.service_enquiries;
create policy "service enquiries operations update" on public.service_enquiries for update to authenticated
using (public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'))
with check (public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'));
drop policy if exists "service enquiry messages members select" on public.service_enquiry_messages;
create policy "service enquiry messages members select" on public.service_enquiry_messages for select to authenticated using (
 enquiry_id in (select se.id from public.service_enquiries se where se.customer_id in (select c.id from public.customers c where c.profile_id=auth.uid()) or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'))
);
drop policy if exists "service enquiry messages members create" on public.service_enquiry_messages;
create policy "service enquiry messages members create" on public.service_enquiry_messages for insert to authenticated with check (
 sender_id=auth.uid() and enquiry_id in (select se.id from public.service_enquiries se where se.customer_id in (select c.id from public.customers c where c.profile_id=auth.uid()) or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'))
);
drop policy if exists "service enquiry attachments members select" on public.service_enquiry_attachments;
create policy "service enquiry attachments members select" on public.service_enquiry_attachments for select to authenticated using (
 enquiry_id in (select se.id from public.service_enquiries se where se.customer_id in (select c.id from public.customers c where c.profile_id=auth.uid()) or public.current_app_role() in ('super_admin','admin','manager','claim_processor','field_executive','director','sales_head','zonal_head','asm','sales_manager','it_super_user','claims_head','sales_operations_head','backoffice_executive','relationship_manager'))
);
drop index if exists public.service_enquiries_assigned_to_created_idx;
