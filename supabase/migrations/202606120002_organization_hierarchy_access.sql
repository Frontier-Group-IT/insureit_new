alter type public.app_role add value if not exists 'director';
alter type public.app_role add value if not exists 'sales_head';
alter type public.app_role add value if not exists 'zonal_head';
alter type public.app_role add value if not exists 'asm';
alter type public.app_role add value if not exists 'sales_manager';
alter type public.app_role add value if not exists 'agent';
alter type public.app_role add value if not exists 'it_super_user';

alter table public.profiles add column if not exists employee_code text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists reporting_manager_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists designation text;
alter table public.profiles add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.customers add column if not exists assigned_agent_id uuid references public.profiles(id) on delete set null;
alter table public.customers add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create index if not exists profiles_reporting_manager_id_idx on public.profiles(reporting_manager_id);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_employee_code_idx on public.profiles(employee_code);
create index if not exists customers_assigned_agent_id_idx on public.customers(assigned_agent_id);

create or replace function public.is_admin_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in ('super_admin', 'admin', 'it_super_user');
$$;

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
    'claim_processor',
    'field_executive'
  );
$$;

create or replace function public.can_manage_users()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in ('super_admin', 'admin', 'it_super_user');
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
    'claim_processor',
    'field_executive'
  );
$$;

create or replace function public.get_user_downline(root_user_id uuid)
returns table(profile_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with recursive downline as (
    select p.id
    from public.profiles p
    where p.id = root_user_id

    union all

    select child.id
    from public.profiles child
    join downline parent on child.reporting_manager_id = parent.id
    where child.is_active = true
  )
  select id from downline;
$$;

create or replace function public.can_access_profile(viewer_id uuid, target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  viewer_role text;
  target_role text;
begin
  if viewer_id is null or target_profile_id is null then
    return false;
  end if;

  if viewer_id = target_profile_id then
    return true;
  end if;

  select role::text into viewer_role from public.profiles where id = viewer_id and is_active = true;
  select role::text into target_role from public.profiles where id = target_profile_id;

  if viewer_role is null then
    return false;
  end if;

  if viewer_role in ('it_super_user', 'admin', 'super_admin') then
    return true;
  end if;

  if viewer_role = 'director' then
    return coalesce(target_role, '') not in ('it_super_user', 'admin', 'super_admin');
  end if;

  if viewer_role = 'customer' then
    return false;
  end if;

  return exists (
    select 1
    from public.get_user_downline(viewer_id) d
    where d.profile_id = target_profile_id
  );
end;
$$;

create or replace function public.can_access_customer(viewer_id uuid, target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer_id is not null
    and target_customer_id is not null
    and (
      public.can_access_full_business_data()
      or exists (
        select 1
        from public.customers c
        where c.id = target_customer_id
          and c.profile_id = viewer_id
      )
      or exists (
        select 1
        from public.customers c
        where c.id = target_customer_id
          and c.assigned_agent_id in (select profile_id from public.get_user_downline(viewer_id))
      )
    );
$$;

create or replace function public.can_access_vehicle(viewer_id uuid, target_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vehicles v
    where v.id = target_vehicle_id
      and public.can_access_customer(viewer_id, v.customer_id)
  );
$$;

create or replace function public.can_access_policy(viewer_id uuid, target_policy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.policies p
    where p.id = target_policy_id
      and public.can_access_customer(viewer_id, p.customer_id)
  );
$$;

create or replace function public.can_access_claim(viewer_id uuid, target_claim_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.claims c
    where c.id = target_claim_id
      and public.can_access_customer(viewer_id, c.customer_id)
  );
$$;

drop policy if exists "profiles self read or ops" on public.profiles;
drop policy if exists "profiles admin manage" on public.profiles;
create policy "profiles hierarchy read"
on public.profiles for select
to authenticated
using (public.can_access_profile(auth.uid(), id));

create policy "profiles it admin insert"
on public.profiles for insert
to authenticated
with check (public.can_manage_users());

create policy "profiles it admin update"
on public.profiles for update
to authenticated
using (public.can_manage_users())
with check (public.can_manage_users());

drop policy if exists "customers ops manage" on public.customers;
drop policy if exists "customers self read" on public.customers;
drop policy if exists "customers self create" on public.customers;
create policy "customers hierarchy read"
on public.customers for select
to authenticated
using (public.can_access_customer(auth.uid(), id));

create policy "customers hierarchy insert"
on public.customers for insert
to authenticated
with check (
  public.can_manage_users()
  or public.can_access_full_business_data()
  or (
    public.current_app_role()::text = 'customer'
    and profile_id = auth.uid()
  )
  or assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
);

create policy "customers hierarchy update"
on public.customers for update
to authenticated
using (
  public.can_manage_users()
  or public.can_access_full_business_data()
  or assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
)
with check (
  public.can_manage_users()
  or public.can_access_full_business_data()
  or assigned_agent_id in (select profile_id from public.get_user_downline(auth.uid()))
);

drop policy if exists "vehicles ops manage" on public.vehicles;
drop policy if exists "vehicles customer read" on public.vehicles;
create policy "vehicles hierarchy read"
on public.vehicles for select
to authenticated
using (public.can_access_customer(auth.uid(), customer_id));

create policy "vehicles hierarchy manage"
on public.vehicles for all
to authenticated
using (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id))
with check (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id));

drop policy if exists "policies ops manage" on public.policies;
drop policy if exists "policies customer read" on public.policies;
create policy "policies hierarchy read"
on public.policies for select
to authenticated
using (public.can_access_customer(auth.uid(), customer_id));

create policy "policies hierarchy manage"
on public.policies for all
to authenticated
using (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id))
with check (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id));

drop policy if exists "claims ops manage" on public.claims;
drop policy if exists "claims customer read" on public.claims;
drop policy if exists "claims customer create own" on public.claims;
create policy "claims hierarchy read"
on public.claims for select
to authenticated
using (public.can_access_customer(auth.uid(), customer_id));

create policy "claims hierarchy insert"
on public.claims for insert
to authenticated
with check (
  public.can_access_full_business_data()
  or (
    public.current_app_role()::text = 'customer'
    and created_by = auth.uid()
    and public.can_access_customer(auth.uid(), customer_id)
    and public.can_access_vehicle(auth.uid(), vehicle_id)
    and public.can_access_policy(auth.uid(), policy_id)
  )
  or (
    public.current_app_role()::text <> 'customer'
    and public.can_access_customer(auth.uid(), customer_id)
    and public.can_access_vehicle(auth.uid(), vehicle_id)
    and public.can_access_policy(auth.uid(), policy_id)
  )
);

create policy "claims hierarchy update"
on public.claims for update
to authenticated
using (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id))
with check (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id));

drop policy if exists "claim documents ops manage" on public.claim_documents;
drop policy if exists "claim documents customer read" on public.claim_documents;
drop policy if exists "claim documents customer upload metadata" on public.claim_documents;
create policy "claim documents hierarchy read"
on public.claim_documents for select
to authenticated
using (public.can_access_customer(auth.uid(), customer_id));

create policy "claim documents hierarchy insert"
on public.claim_documents for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and public.can_access_customer(auth.uid(), customer_id)
  and public.can_access_claim(auth.uid(), claim_id)
);

create policy "claim documents hierarchy update"
on public.claim_documents for update
to authenticated
using (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id))
with check (public.can_access_full_business_data() or public.can_access_customer(auth.uid(), customer_id));

drop policy if exists "claim history ops manage" on public.claim_status_history;
drop policy if exists "claim history customer read" on public.claim_status_history;
create policy "claim history hierarchy read"
on public.claim_status_history for select
to authenticated
using (public.can_access_claim(auth.uid(), claim_id));

create policy "claim history hierarchy insert"
on public.claim_status_history for insert
to authenticated
with check (public.can_access_full_business_data() or public.can_access_claim(auth.uid(), claim_id));

drop policy if exists "claim tasks ops manage" on public.claim_tasks;
drop policy if exists "claim tasks assignee read" on public.claim_tasks;
create policy "claim tasks hierarchy read"
on public.claim_tasks for select
to authenticated
using (assigned_to = auth.uid() or public.can_access_claim(auth.uid(), claim_id));

create policy "claim tasks hierarchy manage"
on public.claim_tasks for all
to authenticated
using (public.can_access_full_business_data() or public.can_access_claim(auth.uid(), claim_id))
with check (public.can_access_full_business_data() or public.can_access_claim(auth.uid(), claim_id));

drop policy if exists "notifications recipient read" on public.notifications;
drop policy if exists "notifications ops manage" on public.notifications;
create policy "notifications hierarchy read"
on public.notifications for select
to authenticated
using (
  profile_id = auth.uid()
  or public.can_access_full_business_data()
  or (customer_id is not null and public.can_access_customer(auth.uid(), customer_id))
  or (claim_id is not null and public.can_access_claim(auth.uid(), claim_id))
);

create policy "notifications hierarchy manage"
on public.notifications for all
to authenticated
using (public.can_access_full_business_data())
with check (public.can_access_full_business_data());

drop policy if exists "audit logs admin read" on public.audit_logs;
drop policy if exists "audit logs ops insert" on public.audit_logs;
create policy "audit logs it admin read"
on public.audit_logs for select
to authenticated
using (public.can_manage_users());

create policy "audit logs business insert"
on public.audit_logs for insert
to authenticated
with check (public.is_operations_role());

drop policy if exists "claim document objects ops access" on storage.objects;
drop policy if exists "claim document objects customer read" on storage.objects;
create policy "claim document objects hierarchy read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'claim-documents'
  and exists (
    select 1
    from public.claim_documents cd
    where cd.storage_path = storage.objects.name
      and public.can_access_customer(auth.uid(), cd.customer_id)
  )
);

create policy "claim document objects hierarchy manage"
on storage.objects for update
to authenticated
using (
  bucket_id = 'claim-documents'
  and public.can_access_full_business_data()
)
with check (
  bucket_id = 'claim-documents'
  and public.can_access_full_business_data()
);
