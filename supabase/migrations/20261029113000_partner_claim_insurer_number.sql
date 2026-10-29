begin;

create or replace function public.partner_app_save_insurer_claim_number(
  p_claim_id uuid,
  p_insurer_claim_no text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $fn$
declare
  v_number text := btrim(coalesce(p_insurer_claim_no, ''));
  v_status text;
  v_stage_complete boolean;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode = '42501';
  end if;
  if length(v_number) < 1 or length(v_number) > 100 or v_number ~ '[[:cntrl:]]' then
    raise exception 'Enter a valid insurer claim number (up to 100 characters)' using errcode = '22023';
  end if;

  select current_status::text into v_status
  from public.claims where id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found' using errcode = '22023';
  end if;

  select exists (
    select 1 from public.claim_stage_details s
    where s.claim_id = p_claim_id
      and s.details ->> 'milestone_key' = 'claim_intimation'
      and nullif(s.details ->> 'completed_at', '') is not null
  ) into v_stage_complete;

  -- Mirrors the existing tracker legacy-status fallback for milestones after Claim Intimation.
  if not v_stage_complete and lower(coalesce(v_status, '')) !~ 
      '(work approval|repair|ri stage|billing|invoice|delivery order|vehicle deliver|payment stage|payment encashment|claim completion in progress|claim complete|settled|closed)' then
    raise exception 'Complete Claim Intimation before adding an insurer claim number' using errcode = '22023';
  end if;

  update public.claims
  set insurer_claim_no = v_number
  where id = p_claim_id;
  return true;
end;
$fn$;

revoke all on function public.partner_app_save_insurer_claim_number(uuid,text) from public, anon;
grant execute on function public.partner_app_save_insurer_claim_number(uuid,text) to authenticated, service_role;

commit;
