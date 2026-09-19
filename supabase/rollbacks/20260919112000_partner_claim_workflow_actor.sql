begin;

drop function if exists public.partner_app_insert_claim_stage_detail(uuid,public.claim_status,jsonb);

create or replace function public.persist_initial_document_submission_from_stage_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
begin
  if new.stage::text not in ('Initial Documents Submitted', 'Documents Submitted') then return new; end if;
  if coalesce(new.details->>'milestone_key', '') <> 'spot_intimation' then return new; end if;
  if auth.uid() is null or new.created_by is distinct from auth.uid() then raise exception 'The workflow user does not match the authenticated user.'; end if;
  if not public.is_operations_role() or not public.can_access_claim(auth.uid(), new.claim_id) then raise exception 'You do not have permission to advance this claim stage.'; end if;
  select * into v_claim from public.claims where id=new.claim_id and claim_service_mode='broker_managed' for update;
  if not found then raise exception 'Managed claim not found.'; end if;
  if v_claim.current_status::text in ('Initial Documents Submitted','Documents Submitted') then return new; end if;
  if v_claim.current_status::text not in ('Initial Documents Pending','Documents Pending') then raise exception 'This claim is not awaiting initial document submission.'; end if;
  return new;
end;
$$;

commit;
