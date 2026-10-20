-- EMERGENCY ROLLBACK ONLY AFTER FOUR-USER CONVERSION.
-- Reverts exactly the four secondary IT Users to prior IT Super User role.
-- This reopens their former privileged access and should be used only as a controlled recovery step.
BEGIN;
DROP TRIGGER IF EXISTS guard_sole_it_super_user_role ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_sole_it_super_user_role();
DO $$
declare
 v_updated integer;
 v_primary_count integer;
begin
 update public.profiles p set role='it_super_user'::public.app_role
 from auth.users u
 where p.id=u.id and p.role='it_user'::public.app_role
   and lower(u.email) in (
     'nikhilawadhwal51@gmail.com',
     'raginigupta259@gmail.com',
     'r.rajak2004@gmail.com',
     'shru.jain2604@gmail.com'
   );
 get diagnostics v_updated=row_count;
 if v_updated<>4 then
   raise exception 'Rollback expected four IT User profiles, changed %',v_updated;
 end if;
 select count(*) into v_primary_count
 from auth.users u join public.profiles p on p.id=u.id
 where lower(u.email)='it@insureit.in' and p.role='it_super_user'::public.app_role;
 if v_primary_count<>1 then raise exception 'Primary IT Super User missing during rollback'; end if;
end $$;
COMMIT;
