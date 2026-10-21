begin;
-- Isolated drafts: writing to claim_stage_details would execute managed claim
-- progression triggers, so Partner draft edits must not write to that table.
create table if not exists public.partner_claim_stage_drafts (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  stage_key text not null check (stage_key in (
    'spot_status','claim_intimation','work_approval','repair_ri',
    'billing','delivery_order','vehicle_delivery','payment_encashment'
  )),
  details jsonb not null default '{}'::jsonb,
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  unique(claim_id,stage_key)
);
alter table public.partner_claim_stage_drafts enable row level security;
revoke all on public.partner_claim_stage_drafts from public,anon,authenticated;
grant select,insert,update on public.partner_claim_stage_drafts to service_role;

create or replace function public.partner_app_save_claim_stage_draft(p_claim_id uuid,p_stage_key text,p_details jsonb)
returns uuid language plpgsql security definer set search_path=public,auth as $fn$
declare v_status text; v_id uuid;
begin
 if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
   raise exception 'Claim is not available in your Partner scope' using errcode='42501';
 end if;
 select current_status::text into v_status from public.claims where id=p_claim_id for update;
 if v_status in ('Settled','Closed','Rejected','Claim Complete') then
   raise exception 'Completed claims cannot be changed' using errcode='22023';
 end if;
 if p_stage_key not in ('spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment') then
   raise exception 'Invalid claim stage' using errcode='22023';
 end if;
 if p_details is null or jsonb_typeof(p_details)<>'object' or pg_column_size(p_details)>16384 then
   raise exception 'Invalid stage details' using errcode='22023';
 end if;
 insert into public.partner_claim_stage_drafts(claim_id,stage_key,details,updated_by)
 values(p_claim_id,p_stage_key,p_details,auth.uid())
 on conflict (claim_id,stage_key) do update
 set details=excluded.details,updated_by=excluded.updated_by,updated_at=now()
 returning id into v_id;
 return v_id;
end;
$fn$;
revoke all on function public.partner_app_save_claim_stage_draft(uuid,text,jsonb) from public,anon;
grant execute on function public.partner_app_save_claim_stage_draft(uuid,text,jsonb) to authenticated,service_role;
create or replace function public.partner_app_get_claim_stage_draft(p_claim_id uuid,p_stage_key text)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $fn$
declare v_details jsonb;
begin
 if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
   raise exception 'Claim is not available in your Partner scope' using errcode='42501';
 end if;
 select details into v_details from public.partner_claim_stage_drafts
 where claim_id=p_claim_id and stage_key=p_stage_key;
 return coalesce(v_details,'{}'::jsonb);
end;
$fn$;
revoke all on function public.partner_app_get_claim_stage_draft(uuid,text) from public,anon;
grant execute on function public.partner_app_get_claim_stage_draft(uuid,text) to authenticated,service_role;
commit;