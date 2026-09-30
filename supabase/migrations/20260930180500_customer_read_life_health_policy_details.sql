-- Allow authenticated users to read Life/Health display details only when the
-- parent policy itself is visible to them through the existing policies RLS.
-- This intentionally does NOT expose life_health_cases to customer clients.

create policy "life health policy details parent policy read"
on public.life_health_policy_details
for select
to authenticated
using (
  exists (
    select 1
    from public.policies parent_policy
    where parent_policy.id = life_health_policy_details.policy_id
  )
);
