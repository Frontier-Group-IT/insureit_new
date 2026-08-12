create or replace function public.capture_customer_document_delete_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- When customer_documents are removed because their parent customer is being
  -- deleted via ON DELETE CASCADE, the customer row is no longer a valid FK
  -- target. In that case there is intentionally no surviving customer activity
  -- timeline to write to, so skip the activity event.
  if not exists (
    select 1
    from public.customers
    where id = old.customer_id
  ) then
    return old;
  end if;

  perform public.insert_customer_activity_event(
    old.customer_id,
    null,
    null,
    null,
    null,
    'customer_documents',
    old.id,
    'customer_kyc_deleted',
    'Customer deleted KYC document',
    concat(coalesce(old.document_type, 'Document'), ' removed from customer profile'),
    'medium',
    jsonb_build_object(
      'document_type', old.document_type,
      'file_name', old.file_name,
      'storage_bucket', old.storage_bucket,
      'storage_path', old.storage_path,
      'mime_type', old.mime_type,
      'file_size', old.file_size
    )
  );

  return old;
end;
$$;
