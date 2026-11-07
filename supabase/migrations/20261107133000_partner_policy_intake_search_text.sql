-- Computed PostgREST field for authorized Partner Policy Intake search.
-- The existing route applies its authenticated role/lead-source filters first.
-- This function has no SECURITY DEFINER privileges and never returns records.
-- Deploy before publishing the Partner app that uses ?search=.
create or replace function public.policy_intake_search_text(
  intake public.policy_intake_requests
)
returns text
language sql
stable
parallel safe
as $function$
  select concat_ws(
    ' ',
    intake.intake_number,
    intake.customer_mobile,
    intake.lead_source_name,
    intake.lead_source_code,
    intake.status,
    intake.ocr_fields::text
  );
$function$;

comment on function public.policy_intake_search_text(public.policy_intake_requests)
  is 'Computed text field for scoped Partner Policy Intake PIR/customer/source/insurer OCR search.';

-- Rollback (if necessary):
-- drop function if exists public.policy_intake_search_text(public.policy_intake_requests);
