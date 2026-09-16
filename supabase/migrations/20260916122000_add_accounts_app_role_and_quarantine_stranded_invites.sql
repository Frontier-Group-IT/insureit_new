-- Add the Accounts staff role to the live profile enum.
--
-- Accounts intentionally receives no default application capabilities in this
-- rollout. Permissions will be designed separately.
--
-- A failed pre-migration Accounts invite could have created an Auth identity
-- whose trigger-created profile remained an unlinked Customer profile. Keep
-- those narrowly identified shells inactive until an administrator retries the
-- employee onboarding flow, where the application can safely recover/link them.

alter type public.app_role add value if not exists 'accounts';

update public.profiles as p
set
  is_active = false,
  updated_at = now()
from auth.users as u
where p.id = u.id
  and p.employee_id is null
  and p.role = 'customer'::public.app_role
  and lower(coalesce(p.email, '')) = lower(coalesce(u.email, ''))
  and lower(coalesce(u.raw_user_meta_data ->> 'app_role', '')) = 'accounts';
