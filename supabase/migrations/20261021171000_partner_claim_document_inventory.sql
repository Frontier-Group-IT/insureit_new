begin;
create or replace function public.partner_app_claim_document_list(p_claim_id uuid)
returns table(id uuid,name text,category text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,auth as $fn$
begin
 if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
   raise exception 'Claim not available to Partner' using errcode='42501';
 end if;
 return query select cd.id,cd.file_name,cd.document_type,cd.created_at from public.claim_documents cd
 where cd.claim_id=p_claim_id order by cd.created_at desc;
end;$fn$;
revoke all on function public.partner_app_claim_document_list(uuid) from public,anon;
grant execute on function public.partner_app_claim_document_list(uuid) to authenticated;
commit;
