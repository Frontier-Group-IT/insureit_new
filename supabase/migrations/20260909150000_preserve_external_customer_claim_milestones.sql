-- Preserve the Customer External Claim journey after Operations enters the same
-- externally sourced claim into the canonical Operations nine-stage workflow.
--
-- External Claims remain classified by policy_service_source. Operations can keep
-- using the broker-managed canonical workflow, while the linked customer retains
-- permission to record the External Claim milestone journey in claim_milestones.
-- Internal/SIBL managed claims are intentionally unaffected.

drop policy if exists "customer can create self managed milestones" on public.claim_milestones;
create policy "customer can create self managed milestones"
on public.claim_milestones
for insert
to authenticated
with check (
  public.current_app_role() = 'customer'::public.app_role
  and recorded_by = auth.uid()
  and recorded_by_actor = 'customer'::public.claim_milestone_actor
  and exists (
    select 1
    from public.claims claim
    where claim.id = claim_milestones.claim_id
      and public.can_access_claim(auth.uid(), claim.id)
      and (
        (
          claim.claim_service_mode = 'self_managed'::public.claim_service_mode
          and claim.assistance_status <> 'accepted'::public.claim_assistance_status
        )
        or (
          claim.policy_service_source = 'external'::public.policy_service_source
          and claim.external_policy_id is not null
        )
      )
  )
);

drop policy if exists "customer can update self managed milestones" on public.claim_milestones;
create policy "customer can update self managed milestones"
on public.claim_milestones
for update
to authenticated
using (
  public.current_app_role() = 'customer'::public.app_role
  and exists (
    select 1
    from public.claims claim
    where claim.id = claim_milestones.claim_id
      and public.can_access_claim(auth.uid(), claim.id)
      and (
        (
          claim.claim_service_mode = 'self_managed'::public.claim_service_mode
          and claim.assistance_status <> 'accepted'::public.claim_assistance_status
        )
        or (
          claim.policy_service_source = 'external'::public.policy_service_source
          and claim.external_policy_id is not null
        )
      )
  )
)
with check (
  public.current_app_role() = 'customer'::public.app_role
  and recorded_by = auth.uid()
  and recorded_by_actor = 'customer'::public.claim_milestone_actor
  and exists (
    select 1
    from public.claims claim
    where claim.id = claim_milestones.claim_id
      and public.can_access_claim(auth.uid(), claim.id)
      and (
        (
          claim.claim_service_mode = 'self_managed'::public.claim_service_mode
          and claim.assistance_status <> 'accepted'::public.claim_assistance_status
        )
        or (
          claim.policy_service_source = 'external'::public.policy_service_source
          and claim.external_policy_id is not null
        )
      )
  )
);
