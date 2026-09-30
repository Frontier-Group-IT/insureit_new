-- Customer app Life/Health card display access.
-- Keep life_health_cases private; expose only the issued-policy detail row when
-- the authenticated user can already read the parent policy under policies RLS.

drop policy if exists "life health policy details parent policy read"
on public.life_health_policy_details;

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
