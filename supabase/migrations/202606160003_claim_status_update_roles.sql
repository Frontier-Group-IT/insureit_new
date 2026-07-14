create or replace function public.can_update_claim_status()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in ('manager', 'claim_processor');
$$;
drop policy if exists "claims hierarchy update" on public.claims;
create policy "claims claims team update"
on public.claims for update
to authenticated
using (
  public.can_update_claim_status()
  and public.can_access_claim(auth.uid(), id)
)
with check (
  public.can_update_claim_status()
  and public.can_access_claim(auth.uid(), id)
);
drop policy if exists "claim history hierarchy insert" on public.claim_status_history;
create policy "claim history claims team insert"
on public.claim_status_history for insert
to authenticated
with check (
  public.can_update_claim_status()
  and public.can_access_claim(auth.uid(), claim_id)
);
