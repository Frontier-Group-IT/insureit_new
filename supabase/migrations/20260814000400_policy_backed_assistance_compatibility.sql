-- Keep claim assistance compatible with both generations of customer external claims:
-- 1) historical claims linked through external_policy_id, and
-- 2) new production claims linked through policy_id with policy_service_source='external'.
--
-- Assistance remains independent from claim ownership. Requesting help does not
-- transfer responsibility; only an accepted review changes claim_service_mode.

create or replace function public.request_claim_assistance(
  p_claim_id uuid,
  p_note text default null
)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_claim
  from public.claims
  where id = p_claim_id;

  if v_claim.id is null
     or not public.can_access_customer(v_claim.customer_id) then
    raise exception 'Claim not available.';
  end if;

  if v_claim.policy_service_source is distinct from 'external'::public.policy_service_source
     or v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode
     or (v_claim.policy_id is null and v_claim.external_policy_id is null) then
    raise exception 'Assistance can only be requested for a self-tracked external-policy claim.';
  end if;

  if v_claim.current_status::text in ('Settled', 'Closed') then
    raise exception 'This claim is already settled.';
  end if;

  if v_claim.assistance_status = 'accepted'::public.claim_assistance_status then
    raise exception 'Sankalp assistance has already been accepted for this claim.';
  end if;

  if v_claim.assistance_status = 'requested'::public.claim_assistance_status then
    raise exception 'Assistance has already been requested for this claim.';
  end if;

  if v_claim.assistance_status not in (
    'not_requested'::public.claim_assistance_status,
    'declined'::public.claim_assistance_status,
    'cancelled'::public.claim_assistance_status
  ) then
    raise exception 'Assistance cannot be requested in the current state.';
  end if;

  update public.claims
  set assistance_status = 'requested',
      assistance_requested_at = now(),
      assistance_requested_by = auth.uid(),
      assistance_resolved_at = null,
      assistance_resolved_by = null,
      assistance_notes = nullif(btrim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

create or replace function public.resolve_claim_assistance(
  p_claim_id uuid,
  p_decision text,
  p_note text default null
)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
  v_role text;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_review_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_role := public.current_app_role()::text;
  if v_role not in ('claim_processor','manager','admin','super_admin','it_super_user') then
    raise exception 'You are not authorised to review claim assistance requests.';
  end if;

  if v_decision not in ('accepted','declined') then
    raise exception 'Decision must be accepted or declined.';
  end if;

  select * into v_claim
  from public.claims
  where id = p_claim_id
  for update;

  if v_claim.id is null then
    raise exception 'Claim not available.';
  end if;

  if v_claim.policy_service_source is distinct from 'external'::public.policy_service_source
     or (v_claim.policy_id is null and v_claim.external_policy_id is null) then
    raise exception 'This is not an external-policy claim.';
  end if;

  if v_claim.assistance_status <> 'requested'::public.claim_assistance_status then
    raise exception 'This claim does not have a pending assistance request.';
  end if;

  if v_claim.current_status::text in ('Settled', 'Closed') then
    raise exception 'This claim is already settled.';
  end if;

  if v_decision = 'accepted' then
    update public.claims
    set assistance_status = 'accepted',
        claim_service_mode = 'broker_managed',
        policy_service_source = 'external',
        assistance_resolved_at = now(),
        assistance_resolved_by = auth.uid(),
        assistance_notes = case
          when v_review_note is null then assistance_notes
          when assistance_notes is null or btrim(assistance_notes) = '' then v_review_note
          else assistance_notes || E'\n\nClaims Desk: ' || v_review_note
        end,
        assigned_to = coalesce(assigned_to, auth.uid()),
        updated_at = now()
    where id = p_claim_id
    returning * into v_claim;
  else
    update public.claims
    set assistance_status = 'declined',
        claim_service_mode = 'self_managed',
        assistance_resolved_at = now(),
        assistance_resolved_by = auth.uid(),
        assistance_notes = case
          when v_review_note is null then assistance_notes
          when assistance_notes is null or btrim(assistance_notes) = '' then v_review_note
          else assistance_notes || E'\n\nClaims Desk: ' || v_review_note
        end,
        updated_at = now()
    where id = p_claim_id
    returning * into v_claim;
  end if;

  return v_claim;
end;
$$;

revoke all on function public.request_claim_assistance(uuid, text) from public;
revoke all on function public.request_claim_assistance(uuid, text) from anon;
grant execute on function public.request_claim_assistance(uuid, text) to authenticated;

revoke all on function public.resolve_claim_assistance(uuid, text, text) from public;
revoke all on function public.resolve_claim_assistance(uuid, text, text) from anon;
grant execute on function public.resolve_claim_assistance(uuid, text, text) to authenticated;
