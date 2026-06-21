-- Allow claim desk managers to persist manager-entered workflow details.
drop policy if exists "claim stage details manager insert" on public.claim_stage_details;
create policy "claim stage details manager insert"
on public.claim_stage_details for insert
to authenticated
with check (
  public.current_app_role() in ('claim_processor', 'manager', 'admin', 'super_admin')
  or public.can_access_full_business_data()
  or public.can_access_claim(auth.uid(), claim_id)
);

drop policy if exists "claim stage details manager update" on public.claim_stage_details;
create policy "claim stage details manager update"
on public.claim_stage_details for update
to authenticated
using (
  public.current_app_role() in ('claim_processor', 'manager', 'admin', 'super_admin')
  or public.can_access_full_business_data()
  or public.can_access_claim(auth.uid(), claim_id)
)
with check (
  public.current_app_role() in ('claim_processor', 'manager', 'admin', 'super_admin')
  or public.can_access_full_business_data()
  or public.can_access_claim(auth.uid(), claim_id)
);
