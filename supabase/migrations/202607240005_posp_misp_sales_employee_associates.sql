-- POSP/MISP associates are now selected from the employee directory by
-- Department = Sales. Portal profiles remain optional.

alter table public.posp_misp_onboarding_profiles
  add column if not exists associate_employee_id uuid references public.employees(id) on delete set null;

create index if not exists posp_misp_profiles_associate_employee_idx
  on public.posp_misp_onboarding_profiles(associate_employee_id);

update public.posp_misp_onboarding_profiles profile
set associate_employee_id = employee.id
from public.profiles portal_profile
join public.employees employee on employee.id = portal_profile.employee_id
where profile.associate_employee_id is null
  and profile.associate_profile_id = portal_profile.id
  and lower(employee.department) = 'sales';
