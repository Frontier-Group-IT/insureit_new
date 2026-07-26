begin;

update public.customer_onboarding_applications app
set status = 'cancelled',
    completed_at = coalesce(app.completed_at, now()),
    updated_at = now(),
    draft_data = coalesce(app.draft_data, '{}'::jsonb) || jsonb_build_object(
      'processing_error',
      'The intermediary profile was not created. Create a fresh onboarding application after deploying the corrected save flow.'
    )
where app.partner_type in ('posp','misp')
  and app.status in ('submitted','under_review','changes_requested')
  and not exists (
    select 1
    from public.posp_misp_onboarding_profiles profile
    where profile.application_id = app.id
  );

commit;
