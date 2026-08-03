-- Read-only verification for Partner -> linked POSP/MISP shared-detail sync.
-- Expected result after applying migration 20260803013000: no rows.

with parent_child as (
  select
    parent_app.id as parent_application_id,
    child_app.id as child_application_id,
    child_app.draft_data ->> 'account_context' as child_context,
    parent_profile.pos_name as parent_pos_name,
    child_profile.pos_name as child_pos_name,
    parent_profile.misp_name as parent_misp_name,
    child_profile.misp_name as child_misp_name,
    parent_profile.applicant_phone as parent_applicant_phone,
    child_profile.applicant_phone as child_applicant_phone,
    parent_profile.applicant_email as parent_applicant_email,
    child_profile.applicant_email as child_applicant_email,
    parent_profile.pan_number as parent_pan_number,
    child_profile.pan_number as child_pan_number,
    parent_profile.gst_number as parent_gst_number,
    child_profile.gst_number as child_gst_number,
    parent_profile.address as parent_address,
    child_profile.address as child_address,
    parent_profile.city as parent_city,
    child_profile.city as child_city,
    parent_profile.state as parent_state,
    child_profile.state as child_state,
    parent_profile.postal_code as parent_postal_code,
    child_profile.postal_code as child_postal_code,
    parent_profile.bank_name as parent_bank_name,
    child_profile.bank_name as child_bank_name,
    parent_profile.bank_ifsc_code as parent_bank_ifsc_code,
    child_profile.bank_ifsc_code as child_bank_ifsc_code,
    parent_profile.associate_name as parent_associate_name,
    child_profile.associate_name as child_associate_name,
    register_row.display_name as register_display_name,
    register_row.mobile as register_mobile,
    register_row.email as register_email,
    register_row.city as register_city
  from public.intermediary_onboarding_applications parent_app
  join public.posp_misp_onboarding_profiles parent_profile
    on parent_profile.application_id = parent_app.id
  join public.intermediary_onboarding_applications child_app
    on child_app.partner_record_id = parent_app.partner_record_id
   and child_app.id <> parent_app.id
   and child_app.draft_data ->> 'account_context' in ('posp', 'misp')
  join public.posp_misp_onboarding_profiles child_profile
    on child_profile.application_id = child_app.id
  left join public.intermediaries register_row
    on register_row.application_id = child_app.id
  where coalesce(nullif(parent_app.draft_data ->> 'account_context', ''), 'partner') = 'partner'
    and parent_app.partner_record_id is not null
)
select *
from parent_child
where
  (child_context = 'posp' and parent_pos_name is distinct from child_pos_name)
  or (child_context = 'misp' and parent_misp_name is distinct from child_misp_name)
  or parent_applicant_phone is distinct from child_applicant_phone
  or parent_applicant_email is distinct from child_applicant_email
  or parent_pan_number is distinct from child_pan_number
  or parent_gst_number is distinct from child_gst_number
  or parent_address is distinct from child_address
  or parent_city is distinct from child_city
  or parent_state is distinct from child_state
  or parent_postal_code is distinct from child_postal_code
  or parent_bank_name is distinct from child_bank_name
  or parent_bank_ifsc_code is distinct from child_bank_ifsc_code
  or parent_associate_name is distinct from child_associate_name
  or register_mobile is distinct from parent_applicant_phone
  or register_email is distinct from parent_applicant_email
  or register_city is distinct from parent_city
order by parent_application_id, child_application_id;
