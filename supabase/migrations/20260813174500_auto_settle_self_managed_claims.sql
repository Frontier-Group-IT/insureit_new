-- Settle a self-tracked claim automatically as soon as all nine customer
-- milestones are complete. This covers both RPC-backed milestones and the
-- dedicated Spot Status upsert path without changing the existing managed
-- claim workflow.

create or replace function public.auto_settle_self_managed_claim_from_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
  v_completed_count integer;
  v_was_settled boolean;
begin
  select * into v_claim
  from public.claims
  where id = new.claim_id;

  if v_claim.id is null
     or v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode then
    return new;
  end if;

  select count(*) into v_completed_count
  from public.claim_milestones
  where claim_id = new.claim_id
    and milestone_key in (
      'spot_intimation','spot_status','claim_intimation','work_approval',
      'repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment'
    )
    and milestone_status in ('completed','not_applicable');

  if v_completed_count <> 9 then
    return new;
  end if;

  v_was_settled := v_claim.current_status::text = 'Settled';

  update public.claims
  set current_status = 'Settled',
      assistance_status = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then 'cancelled'::public.claim_assistance_status
        else assistance_status
      end,
      assistance_resolved_at = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then now()
        else assistance_resolved_at
      end,
      updated_at = now()
  where id = new.claim_id;

  if not v_was_settled then
    insert into public.notifications (
      customer_id, claim_id, title, message, status
    ) values (
      v_claim.customer_id,
      v_claim.id,
      'Claim settled',
      'All 9 self-tracked claim milestones are complete. This claim is now available in your settled claim history.',
      'unread'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_settle_self_managed_claim on public.claim_milestones;

create trigger trg_auto_settle_self_managed_claim
after insert or update of milestone_status, completed_at, details
on public.claim_milestones
for each row
execute function public.auto_settle_self_managed_claim_from_milestone();

revoke all on function public.auto_settle_self_managed_claim_from_milestone() from public;
revoke all on function public.auto_settle_self_managed_claim_from_milestone() from anon;
