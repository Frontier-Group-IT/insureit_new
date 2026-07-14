-- Allow mobile Corporate KYC applicants to save their login contacts.
-- The mobile corporate submission writes CEO/Admin/SPOC rows before portal review.
-- Keep the scope limited to contacts attached to the authenticated user's own application.

alter table public.customer_onboarding_contacts enable row level security;

drop policy if exists onboarding_contacts_insert_applicant on public.customer_onboarding_contacts;
create policy onboarding_contacts_insert_applicant
on public.customer_onboarding_contacts for insert
to authenticated
with check (
  exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_contacts.application_id
      and application.profile_id = auth.uid()
      and application.status in ('in_progress', 'changes_requested')
  )
);

drop policy if exists onboarding_contacts_update_applicant on public.customer_onboarding_contacts;
create policy onboarding_contacts_update_applicant
on public.customer_onboarding_contacts for update
to authenticated
using (
  exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_contacts.application_id
      and application.profile_id = auth.uid()
      and application.status in ('in_progress', 'changes_requested')
  )
)
with check (
  exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_contacts.application_id
      and application.profile_id = auth.uid()
      and application.status in ('in_progress', 'changes_requested')
  )
);

drop policy if exists onboarding_contacts_delete_applicant on public.customer_onboarding_contacts;
create policy onboarding_contacts_delete_applicant
on public.customer_onboarding_contacts for delete
to authenticated
using (
  exists (
    select 1
    from public.customer_onboarding_applications application
    where application.id = customer_onboarding_contacts.application_id
      and application.profile_id = auth.uid()
      and application.status in ('in_progress', 'changes_requested')
  )
);
