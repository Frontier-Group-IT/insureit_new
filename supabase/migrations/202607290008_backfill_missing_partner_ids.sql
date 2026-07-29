begin;

do $$
declare
  r record;
  v_partner_id text;
begin
  for r in
    select
      p.application_id,
      coalesce(p.updated_by, p.created_by, a.initiated_by) as actor_id
    from public.posp_misp_onboarding_profiles p
    join public.intermediary_onboarding_applications a on a.id = p.application_id
    where p.partner_id is null
      and p.workflow_stage in ('training','completed')
      and exists (
        select 1 from public.intermediary_onboarding_documents d
        where d.application_id = p.application_id and d.document_type = 'aadhaar_front'
      )
      and exists (
        select 1 from public.intermediary_onboarding_documents d
        where d.application_id = p.application_id and d.document_type = 'pan_copy'
      )
      and exists (
        select 1 from public.intermediary_onboarding_documents d
        where d.application_id = p.application_id and d.document_type = 'cancelled_cheque'
      )
  loop
    if r.actor_id is not null then
      v_partner_id := public.issue_partner_identity(r.application_id, r.actor_id);
      perform public.sync_partner_intermediary(r.application_id);
    end if;
  end loop;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select application_id
    from public.posp_misp_onboarding_profiles
    where partner_id is not null
  loop
    perform public.sync_partner_intermediary(r.application_id);
  end loop;
end;
$$;

commit;
