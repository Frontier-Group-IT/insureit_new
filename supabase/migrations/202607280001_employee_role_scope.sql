-- Apply the approved initial employee role mapping without introducing new roles.
-- CPO temporarily uses Director access, Operations Head uses sales_operations_head,
-- and Senior Relationship Manager uses relationship_manager.

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select employee_id from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.employee_is_in_my_hierarchy(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive downline as (
    select e.id
    from public.employees e
    where e.id = public.current_employee_id()
    union all
    select child.id
    from public.employees child
    join downline parent on child.reporting_manager_id = parent.id
  )
  select exists(select 1 from downline where id = target_employee_id);
$$;

create or replace function public.can_view_employee_record(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_app_role()::text
    when 'super_admin' then true
    when 'admin' then true
    when 'it_super_user' then true
    when 'manager' then true
    when 'director' then true
    when 'sales_operations_head' then true
    when 'sales_head' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'zonal_head' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'asm' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'sales_manager' then public.employee_is_in_my_hierarchy(target_employee_id)
    when 'relationship_manager' then target_employee_id = public.current_employee_id()
    else false
  end;
$$;

create or replace function public.can_view_employees()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in (
    'super_admin','admin','it_super_user','manager','director','sales_operations_head',
    'sales_head','zonal_head','asm','sales_manager','relationship_manager'
  );
$$;

drop policy if exists "employees staff read" on public.employees;
create policy "employees scoped read"
on public.employees for select
to authenticated
using (public.can_view_employee_record(id));

-- Update linked portal profiles for the employee tree already onboarded in the portal.
update public.profiles p
set role = case e.employee_code
  when 'SIBL/0001' then 'director'::public.app_role
  when 'SIBL/0002' then 'sales_head'::public.app_role
  when 'SIBL/0003' then 'asm'::public.app_role
  when 'SIBL/0004' then 'relationship_manager'::public.app_role
  when 'SIBL/0005' then 'relationship_manager'::public.app_role
  when 'SIBL/0006' then 'relationship_manager'::public.app_role
  when 'SIBL/0007' then 'asm'::public.app_role
  when 'SIBL/0008' then 'relationship_manager'::public.app_role
  when 'SIBL/0009' then 'sales_head'::public.app_role
  when 'SIBL/0010' then 'sales_operations_head'::public.app_role
  when 'SIBL/0011' then 'sales_head'::public.app_role
  when 'SIBL/0012' then 'relationship_manager'::public.app_role
  when 'SIBL/0013' then 'relationship_manager'::public.app_role
  when 'SIBL/0014' then 'director'::public.app_role
  else p.role
end,
updated_at = now()
from public.employees e
where p.employee_id = e.id
  and e.employee_code in (
    'SIBL/0001','SIBL/0002','SIBL/0003','SIBL/0004','SIBL/0005','SIBL/0006','SIBL/0007',
    'SIBL/0008','SIBL/0009','SIBL/0010','SIBL/0011','SIBL/0012','SIBL/0013','SIBL/0014'
  );
