begin;
revoke all on function public.partner_app_claim_document_list(uuid) from authenticated;
drop function if exists public.partner_app_claim_document_list(uuid);
commit;
