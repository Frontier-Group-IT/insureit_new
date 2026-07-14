-- Allow authenticated KYC managers to review and promote application files
-- without exposing a service-role key to the web portal.

drop policy if exists "Onboarding managers can manage customer document files" on storage.objects;
create policy "Onboarding managers can manage customer document files"
on storage.objects for all to authenticated
using (
  bucket_id = 'customer-documents'
  and public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user',
    'sales_operations_head',
    'backoffice_executive'
  )
)
with check (
  bucket_id = 'customer-documents'
  and public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user',
    'sales_operations_head',
    'backoffice_executive'
  )
);
