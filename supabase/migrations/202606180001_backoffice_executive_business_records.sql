alter type public.app_role add value if not exists 'backoffice_executive';

create or replace function public.is_operations_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in (
    'super_admin',
    'admin',
    'it_super_user',
    'director',
    'sales_head',
    'zonal_head',
    'asm',
    'sales_manager',
    'agent',
    'manager',
    'backoffice_executive',
    'claim_processor',
    'field_executive'
  );
$$;

create or replace function public.can_access_full_business_data()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in (
    'super_admin',
    'admin',
    'it_super_user',
    'director',
    'manager',
    'backoffice_executive',
    'claim_processor',
    'field_executive'
  );
$$;
