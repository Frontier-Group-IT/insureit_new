begin;

create or replace function public.sync_intermediary_application_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workflow_stage = 'completed' and old.workflow_stage is distinct from new.workflow_stage then
    update public.customer_onboarding_applications
    set status = 'approved',
        reviewed_by = coalesce(new.updated_by, reviewed_by),
        reviewed_at = coalesce(reviewed_at, now()),
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where id = new.application_id;
  elsif new.partner_decision = 'do_not_proceed' and old.partner_decision is distinct from new.partner_decision then
    update public.customer_onboarding_applications
    set status = 'rejected',
        reviewed_by = coalesce(new.updated_by, reviewed_by),
        reviewed_at = coalesce(reviewed_at, now()),
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where id = new.application_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_intermediary_application_status on public.posp_misp_onboarding_profiles;
create trigger trg_sync_intermediary_application_status
after update of workflow_stage, partner_decision on public.posp_misp_onboarding_profiles
for each row execute function public.sync_intermediary_application_status();

update public.customer_onboarding_applications app
set status = 'approved',
    completed_at = coalesce(app.completed_at, profile.training_completed_at, now()),
    updated_at = now()
from public.posp_misp_onboarding_profiles profile
where profile.application_id = app.id
  and profile.workflow_stage = 'completed'
  and app.status not in ('approved','cancelled');

commit;
