-- Align the full claim workflow RLS surface with the portal's effective
-- manage_claims permission model.
--
-- Existing customer/hierarchy policies remain intact. These additional policies
-- only open claim workflow rows to users whose effective manage_claims access is
-- permitted for the target claim. Organization-scoped grants (for example an
-- employee override) therefore work consistently across every managed-claim
-- workflow table instead of only the claims table.

create or replace function public.can_manage_claim(target_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.can_manage_claims_organization()
    or (
      public.can_update_claim_status()
      and public.can_access_claim(auth.uid(), target_claim_id)
    ),
    false
  );
$$;

revoke all on function public.can_manage_claim(uuid) from public;
grant execute on function public.can_manage_claim(uuid) to authenticated;
grant execute on function public.can_manage_claim(uuid) to service_role;

-- Claim stage details: used by all Operations journey stages, including the
-- terminal Payment Encashment save shown in the reported production failure.
drop policy if exists "claim stage details effective manage claims select" on public.claim_stage_details;
create policy "claim stage details effective manage claims select"
on public.claim_stage_details for select to authenticated
using (public.can_manage_claim(claim_id));

drop policy if exists "claim stage details effective manage claims insert" on public.claim_stage_details;
create policy "claim stage details effective manage claims insert"
on public.claim_stage_details for insert to authenticated
with check (
  public.can_manage_claim(claim_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "claim stage details effective manage claims update" on public.claim_stage_details;
create policy "claim stage details effective manage claims update"
on public.claim_stage_details for update to authenticated
using (public.can_manage_claim(claim_id))
with check (public.can_manage_claim(claim_id));

-- Status history is written whenever a claim stage advances or an Operations
-- edit is audited.
drop policy if exists "claim history effective manage claims select" on public.claim_status_history;
create policy "claim history effective manage claims select"
on public.claim_status_history for select to authenticated
using (public.can_manage_claim(claim_id));

drop policy if exists "claim history effective manage claims insert" on public.claim_status_history;
create policy "claim history effective manage claims insert"
on public.claim_status_history for insert to authenticated
with check (
  public.can_manage_claim(claim_id)
  and (changed_by is null or changed_by = auth.uid())
);

-- Managed-claim documents must be readable and processable by the same effective
-- claim manager. Existing self-managed customer protections are not removed.
drop policy if exists "claim documents effective manage claims select" on public.claim_documents;
create policy "claim documents effective manage claims select"
on public.claim_documents for select to authenticated
using (public.can_manage_claim(claim_id));

drop policy if exists "claim documents effective manage claims insert" on public.claim_documents;
create policy "claim documents effective manage claims insert"
on public.claim_documents for insert to authenticated
with check (
  public.can_manage_claim(claim_id)
  and (uploaded_by is null or uploaded_by = auth.uid())
);

drop policy if exists "claim documents effective manage claims update" on public.claim_documents;
create policy "claim documents effective manage claims update"
on public.claim_documents for update to authenticated
using (public.can_manage_claim(claim_id))
with check (public.can_manage_claim(claim_id));

drop policy if exists "claim documents effective manage claims delete" on public.claim_documents;
create policy "claim documents effective manage claims delete"
on public.claim_documents for delete to authenticated
using (public.can_manage_claim(claim_id));

-- Structured document verification records use claim_id directly and therefore
-- follow the same target-claim authorization rule.
drop policy if exists "claim document verifications effective manage claims select" on public.claim_document_verifications;
create policy "claim document verifications effective manage claims select"
on public.claim_document_verifications for select to authenticated
using (public.can_manage_claim(claim_id));

drop policy if exists "claim document verifications effective manage claims insert" on public.claim_document_verifications;
create policy "claim document verifications effective manage claims insert"
on public.claim_document_verifications for insert to authenticated
with check (
  public.can_manage_claim(claim_id)
  and (verified_by is null or verified_by = auth.uid())
);

drop policy if exists "claim document verifications effective manage claims update" on public.claim_document_verifications;
create policy "claim document verifications effective manage claims update"
on public.claim_document_verifications for update to authenticated
using (public.can_manage_claim(claim_id))
with check (public.can_manage_claim(claim_id));

drop policy if exists "claim document verifications effective manage claims delete" on public.claim_document_verifications;
create policy "claim document verifications effective manage claims delete"
on public.claim_document_verifications for delete to authenticated
using (public.can_manage_claim(claim_id));

-- Claim tasks are part of Operations processing and assignment. Keep assigned-to
-- behaviour from existing policies while adding the effective manage_claims path.
drop policy if exists "claim tasks effective manage claims select" on public.claim_tasks;
create policy "claim tasks effective manage claims select"
on public.claim_tasks for select to authenticated
using (public.can_manage_claim(claim_id));

drop policy if exists "claim tasks effective manage claims insert" on public.claim_tasks;
create policy "claim tasks effective manage claims insert"
on public.claim_tasks for insert to authenticated
with check (
  public.can_manage_claim(claim_id)
  and (created_by is null or created_by = auth.uid())
);

drop policy if exists "claim tasks effective manage claims update" on public.claim_tasks;
create policy "claim tasks effective manage claims update"
on public.claim_tasks for update to authenticated
using (public.can_manage_claim(claim_id))
with check (public.can_manage_claim(claim_id));

drop policy if exists "claim tasks effective manage claims delete" on public.claim_tasks;
create policy "claim tasks effective manage claims delete"
on public.claim_tasks for delete to authenticated
using (public.can_manage_claim(claim_id));

-- Claim financials may be used by billing/settlement flows. Align them now so a
-- user cannot pass claim-stage authorization and then fail on the financial row.
drop policy if exists "claim financials effective manage claims select" on public.claim_financials;
create policy "claim financials effective manage claims select"
on public.claim_financials for select to authenticated
using (public.can_manage_claim(claim_id));

drop policy if exists "claim financials effective manage claims insert" on public.claim_financials;
create policy "claim financials effective manage claims insert"
on public.claim_financials for insert to authenticated
with check (public.can_manage_claim(claim_id));

drop policy if exists "claim financials effective manage claims update" on public.claim_financials;
create policy "claim financials effective manage claims update"
on public.claim_financials for update to authenticated
using (public.can_manage_claim(claim_id))
with check (public.can_manage_claim(claim_id));

drop policy if exists "claim financials effective manage claims delete" on public.claim_financials;
create policy "claim financials effective manage claims delete"
on public.claim_financials for delete to authenticated
using (public.can_manage_claim(claim_id));

-- Claim milestones are primarily used by customer/self-managed tracking, but
-- Operations can also need to read them when handling or taking over a claim.
-- Only SELECT is added here; customer milestone write protections remain unchanged.
drop policy if exists "claim milestones effective manage claims select" on public.claim_milestones;
create policy "claim milestones effective manage claims select"
on public.claim_milestones for select to authenticated
using (public.can_manage_claim(claim_id));
