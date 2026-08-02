begin;

create or replace function public.sync_registered_iib_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.iib_registration_status = 'registered' then
    update public.intermediary_onboarding_applications
    set registration_status = 'iib_registered',
        updated_at = now()
    where id = new.application_id
      and registration_status is distinct from 'iib_registered';
  end if;

  return new;
end;
$$;

drop trigger if exists intermediary_assignment_sync_registered_iib_status
  on public.intermediary_training_exam_assignments;

create trigger intermediary_assignment_sync_registered_iib_status
after insert or update of iib_registration_status
on public.intermediary_training_exam_assignments
for each row
execute function public.sync_registered_iib_application_status();

update public.intermediary_onboarding_applications application
set registration_status = 'iib_registered',
    updated_at = now()
from public.intermediary_training_exam_assignments assignment
where assignment.application_id = application.id
  and assignment.iib_registration_status = 'registered'
  and application.registration_status is distinct from 'iib_registered';

commit;
