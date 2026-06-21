create policy "notifications claim participants insert"
on public.notifications for insert
to authenticated
with check (
  profile_id is null
  and claim_id is not null
  and public.can_access_claim(auth.uid(), claim_id)
);

create policy "notifications claim participants update"
on public.notifications for update
to authenticated
using (
  profile_id = auth.uid()
  or (
    profile_id is null
    and claim_id is not null
    and public.can_access_claim(auth.uid(), claim_id)
  )
)
with check (
  profile_id = auth.uid()
  or (
    profile_id is null
    and claim_id is not null
    and public.can_access_claim(auth.uid(), claim_id)
  )
);
