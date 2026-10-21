begin;
revoke all on function public.partner_app_complete_claim_stage(uuid,text,jsonb) from authenticated;
drop function if exists public.partner_app_complete_claim_stage(uuid,text,jsonb);
commit;
