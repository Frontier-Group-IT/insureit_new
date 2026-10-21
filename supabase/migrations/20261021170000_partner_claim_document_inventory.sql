begin;
create or replace function public.partner_app_claim_documents(p_claim_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $fn$
declare v_result jsonb;
begin
 if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
   raise exception 'Claim document access denied' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',d.id,'name',d.file_name,'category',d.document_type
 ) order by d.created_at desc),'[]'::jsonb) into v_result
 from public.claim_documents d
 where d.claim_id=p_claim_id;
 return v_result;
end;
$fn$;
revoke all on function public.partner_app_claim_documents(uuid) from public,anon;
grant execute on function public.partner_app_claim_documents(uuid) to authenticated,service_role;
commit;