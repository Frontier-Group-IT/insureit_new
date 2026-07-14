create or replace function public.can_process_claim_documents()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in ('manager', 'claim_processor');
$$;
drop policy if exists "claim documents hierarchy update" on public.claim_documents;
create policy "claim documents claims team update"
on public.claim_documents for update
to authenticated
using (
  public.can_process_claim_documents()
  and public.can_access_claim(auth.uid(), claim_id)
)
with check (
  public.can_process_claim_documents()
  and public.can_access_claim(auth.uid(), claim_id)
);
