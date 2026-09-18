begin;

create or replace function public.partner_app_can_read_registration_document_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth, storage
as $$
  select exists (
    select 1
    from public.intermediary_onboarding_documents d
    join public.intermediary_portal_accounts ipa
      on ipa.application_id = d.application_id
    where d.storage_bucket = p_bucket
      and d.storage_path = p_path
      and ipa.auth_user_id = auth.uid()
      and ipa.status = 'active'
  );
$$;

revoke all on function public.partner_app_can_read_registration_document_object(text, text) from public, anon;
grant execute on function public.partner_app_can_read_registration_document_object(text, text) to authenticated, service_role;

drop policy if exists "Partner portal users can read own intermediary onboarding files" on storage.objects;

create policy "Partner portal users can read own intermediary onboarding files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-documents'
  and public.partner_app_can_read_registration_document_object(bucket_id, name)
);

commit;
