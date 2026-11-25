-- Match the secure Case Register document access model for Partner policy details.
-- No unrestricted storage access; all reads are anchored to the existing Partner policy scope.
create or replace function public.partner_app_policy_documents(p_policy_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, auth
as $fn$
declare v_items jsonb;
begin
  if auth.uid() is null or p_policy_id is null or not public.partner_app_policy_in_scope(p_policy_id) then
    raise exception 'Policy documents are not available in your Partner scope' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'source', x.source, 'type', x.document_type,
    'name', coalesce(nullif(x.file_name,''), replace(x.document_type,'_',' ')),
    'mimeType', x.mime_type, 'size', x.file_size
  ) order by x.created_at desc nulls last, x.id), '[]'::jsonb)
  into v_items
  from (
    select d.id, 'policy'::text as source, d.document_type, d.file_name, d.mime_type, d.file_size, d.created_at
    from public.policy_documents d
    where d.policy_id=p_policy_id
      and d.storage_bucket in ('policy-documents','customer-documents')
      and nullif(d.storage_path,'') is not null
    union all
    select d.id, 'life_health'::text, d.document_type, d.file_name, d.mime_type, d.file_size, d.created_at
    from public.life_health_case_documents d
    join public.life_health_cases c on c.id=d.case_id
    where c.final_policy_id=p_policy_id
      and d.storage_bucket='policy-documents'
      and nullif(d.storage_path,'') is not null
  ) x;
  return v_items;
end;
$fn$;

create or replace function public.partner_app_policy_document_preview_ref(
  p_policy_id uuid, p_document_id uuid, p_source text
) returns jsonb language plpgsql stable security definer
set search_path = public, auth
as $fn$
declare v_bucket text; v_path text;
begin
  if auth.uid() is null or p_policy_id is null or p_document_id is null
    or not public.partner_app_policy_in_scope(p_policy_id)
    or p_source not in ('policy','life_health') then
    raise exception 'Policy document is not available in your Partner scope' using errcode='42501';
  end if;
  if p_source='policy' then
    select d.storage_bucket, d.storage_path into v_bucket,v_path
    from public.policy_documents d where d.id=p_document_id and d.policy_id=p_policy_id
      and d.storage_bucket in ('policy-documents','customer-documents')
    limit 1;
  else
    select d.storage_bucket, d.storage_path into v_bucket,v_path
    from public.life_health_case_documents d
    join public.life_health_cases c on c.id=d.case_id
    where d.id=p_document_id and c.final_policy_id=p_policy_id
      and d.storage_bucket='policy-documents'
    limit 1;
  end if;
  if v_bucket is null or nullif(v_path,'') is null then
    raise exception 'Document is not available in your Partner scope' using errcode='42501';
  end if;
  return jsonb_build_object('bucket',v_bucket,'path',v_path);
end;
$fn$;

-- Storage signing checks the same document-to-policy relationship.
-- This SECURITY DEFINER helper only returns a boolean, never a file path.
create or replace function public.partner_app_policy_document_storage_in_scope(
  p_bucket text, p_path text
) returns boolean language plpgsql stable security definer
set search_path = public, auth
as $fn$
begin
  if auth.uid() is null or p_bucket not in ('policy-documents','customer-documents')
    or nullif(p_path,'') is null then return false; end if;
  return exists (
    select 1 from public.policy_documents d
    where d.storage_bucket=p_bucket and d.storage_path=p_path
      and public.partner_app_policy_in_scope(d.policy_id)
  ) or (
    p_bucket='policy-documents' and exists (
      select 1
      from public.life_health_case_documents d
      join public.life_health_cases c on c.id=d.case_id
      where d.storage_bucket=p_bucket and d.storage_path=p_path
        and c.final_policy_id is not null
        and public.partner_app_policy_in_scope(c.final_policy_id)
    )
  );
end;
$fn$;

revoke all on function public.partner_app_policy_documents(uuid) from public, anon;
revoke all on function public.partner_app_policy_document_preview_ref(uuid,uuid,text) from public, anon;
revoke all on function public.partner_app_policy_document_storage_in_scope(text,text) from public, anon;
grant execute on function public.partner_app_policy_documents(uuid) to authenticated;
grant execute on function public.partner_app_policy_document_preview_ref(uuid,uuid,text) to authenticated;
grant execute on function public.partner_app_policy_document_storage_in_scope(text,text) to authenticated;

create policy "partner scoped policy document read"
on storage.objects for select to authenticated
using (
  bucket_id in ('policy-documents','customer-documents')
  and public.partner_app_policy_document_storage_in_scope(bucket_id, name)
);
