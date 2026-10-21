begin;
revoke all on function public.partner_app_save_claim_stage_draft(uuid,text,jsonb) from authenticated;
drop function if exists public.partner_app_save_claim_stage_draft(uuid,text,jsonb);
commit;
