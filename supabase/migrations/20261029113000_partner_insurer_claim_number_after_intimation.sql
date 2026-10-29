-- Partner App: insurer claim number can be recorded only after Claim Intimation is completed.
-- The control number (claim_no) is never modified.
begin;

create or replace function public.partner_app_save_insurer_claim_number(
  p_claim_id uuid,
  p_insurer_claim_no text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_number text := btrim(coalesce(p_insurer_claim_no, ''));
  v_status text;
  v_allowed boolean;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode='42501';
  end if;
  if length(v_number) < 1 or length(v_number) > 80 or v_number ~ '[[:cntrl:]]' then
    raise exception 'Enter a valid claim number (up to 80 characters)' using errcode='22023';
  end if;

  select c.current_status::text into v_status
  from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found' using errcode='22023'; end if;

  -- New workflows: milestone completion is persisted in claim_stage_details.
  select exists (
    select 1 from public.claim_stage_details s
    where s.claim_id = p_claim_id
      and s.details ->> 'milestone_key' in
        ('claim_intimation','work_approval','repair_ri','billing',
         'delivery_order','vehicle_delivery','payment_encashment')
      and s.details ? 'completed_at'
  ) into v_allowed;

  -- Legacy claims: permit only statuses strictly later than Claim Intimation.
  if not v_allowed then
    v_allowed := lower(coalesce(v_status,'')) ~
      '(work approval|repair|ri stage|billing|invoice|delivery order|vehicle deliver|payment|settled|closed|claim complete)';
  end if;
  if not v_allowed then
    raise exception 'Complete Claim Intimation before adding a claim number' using errcode='22023';
  end if;

  update public.claims set insurer_claim_no = v_number where id = p_claim_id;
  return jsonb_build_object('ok', true, 'insurer_claim_no', v_number);
end;
$fn$;

revoke all on function public.partner_app_save_insurer_claim_number(uuid,text) from public, anon;
grant execute on function public.partner_app_save_insurer_claim_number(uuid,text) to authenticated, service_role;

commit;
