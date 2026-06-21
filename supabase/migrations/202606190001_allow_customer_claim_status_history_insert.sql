drop policy if exists "claim history customer insert own claim" on public.claim_status_history;

create policy "claim history customer insert own claim"
on public.claim_status_history for insert
to authenticated
with check (
  changed_by = auth.uid()
  and (
    public.can_access_claim(auth.uid(), claim_id)
    or exists (
      select 1
      from public.claims c
      join public.customers cu on cu.id = c.customer_id
      where c.id = claim_status_history.claim_id
        and cu.profile_id = auth.uid()
    )
  )
);
