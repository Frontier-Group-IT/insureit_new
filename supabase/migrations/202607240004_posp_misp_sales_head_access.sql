-- Allow Sales Head to manage POSP/MISP onboarding while keeping broader site
-- administration reserved for IT Head/Admin/Super Admin roles.

create or replace function public.can_manage_posp_misp_onboarding()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role()::text in (
    'super_admin',
    'admin',
    'manager',
    'it_super_user',
    'sales_head',
    'sales_operations_head',
    'backoffice_executive'
  );
$$;

revoke all on function public.can_manage_posp_misp_onboarding() from public;
grant execute on function public.can_manage_posp_misp_onboarding() to authenticated;

drop policy if exists "Managers can manage POSP MISP profiles"
  on public.posp_misp_onboarding_profiles;
create policy "Managers can manage POSP MISP profiles"
on public.posp_misp_onboarding_profiles for all to authenticated
using (public.can_manage_posp_misp_onboarding())
with check (public.can_manage_posp_misp_onboarding());

drop policy if exists "Managers can manage POSP MISP import batches"
  on public.posp_misp_import_batches;
create policy "Managers can manage POSP MISP import batches"
on public.posp_misp_import_batches for all to authenticated
using (public.can_manage_posp_misp_onboarding())
with check (public.can_manage_posp_misp_onboarding());

drop policy if exists "Managers can manage POSP MISP import rows"
  on public.posp_misp_import_rows;
create policy "Managers can manage POSP MISP import rows"
on public.posp_misp_import_rows for all to authenticated
using (public.can_manage_posp_misp_onboarding())
with check (public.can_manage_posp_misp_onboarding());

drop policy if exists "Managers can manage POSP MISP import row documents"
  on public.posp_misp_import_row_documents;
create policy "Managers can manage POSP MISP import row documents"
on public.posp_misp_import_row_documents for all to authenticated
using (public.can_manage_posp_misp_onboarding())
with check (public.can_manage_posp_misp_onboarding());

drop policy if exists "POSP MISP managers can manage POSP MISP applications"
  on public.customer_onboarding_applications;
create policy "POSP MISP managers can manage POSP MISP applications"
on public.customer_onboarding_applications for all to authenticated
using (
  public.can_manage_posp_misp_onboarding()
  and partner_type in ('posp', 'misp')
)
with check (
  public.can_manage_posp_misp_onboarding()
  and partner_type in ('posp', 'misp')
);

drop policy if exists "POSP MISP managers can manage POSP MISP documents"
  on public.customer_onboarding_documents;
create policy "POSP MISP managers can manage POSP MISP documents"
on public.customer_onboarding_documents for all to authenticated
using (
  public.can_manage_posp_misp_onboarding()
  and exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_documents.application_id
      and application.partner_type in ('posp', 'misp')
  )
)
with check (
  public.can_manage_posp_misp_onboarding()
  and exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_documents.application_id
      and application.partner_type in ('posp', 'misp')
  )
);

drop policy if exists "POSP MISP managers can manage POSP MISP contacts"
  on public.customer_onboarding_contacts;
create policy "POSP MISP managers can manage POSP MISP contacts"
on public.customer_onboarding_contacts for all to authenticated
using (
  public.can_manage_posp_misp_onboarding()
  and exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_contacts.application_id
      and application.partner_type in ('posp', 'misp')
  )
)
with check (
  public.can_manage_posp_misp_onboarding()
  and exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_contacts.application_id
      and application.partner_type in ('posp', 'misp')
  )
);

drop policy if exists "POSP MISP managers can read POSP MISP onboarding files"
  on storage.objects;
create policy "POSP MISP managers can read POSP MISP onboarding files"
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-documents'
  and public.can_manage_posp_misp_onboarding()
  and exists (
    select 1
    from public.customer_onboarding_documents document
    join public.customer_onboarding_applications application
      on application.id = document.application_id
    where document.storage_bucket = storage.objects.bucket_id
      and document.storage_path = storage.objects.name
      and application.partner_type in ('posp', 'misp')
  )
);

drop policy if exists "POSP MISP managers can read POSP MISP import files"
  on storage.objects;
create policy "POSP MISP managers can read POSP MISP import files"
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-documents'
  and public.can_manage_posp_misp_onboarding()
  and exists (
    select 1
    from public.posp_misp_import_row_documents document
    where document.storage_bucket = storage.objects.bucket_id
      and document.storage_path = storage.objects.name
  )
);

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef(
    'public.approve_posp_misp_onboarding_application(uuid, uuid, uuid, uuid)'::regprocedure
  )
    into function_definition;

  if function_definition is null then
    raise exception 'approve_posp_misp_onboarding_application RPC is unavailable.';
  end if;

  if function_definition not like '%''sales_head''%' then
    function_definition := replace(
      function_definition,
      '''sales_operations_head'', ''backoffice_executive''',
      '''sales_operations_head'', ''sales_head'', ''backoffice_executive'''
    );
  end if;

  execute function_definition;
end;
$$;
