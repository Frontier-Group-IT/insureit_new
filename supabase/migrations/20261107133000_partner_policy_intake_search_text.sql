-- Computed PostgREST field for authorized Partner Policy Intake search.
-- The existing route applies its authenticated role/lead-source filters first.
-- The composite argument is unnamed to avoid a new callable RPC endpoint.
-- This function has no SECURITY DEFINER privileges and never returns records.
-- Deploy before publishing the Partner app that uses ?search=.
create or replace function public.policy_intake_search_text(
  public.policy_intake_requests
)
returns text
language sql
stable
parallel safe
as $function$
  select concat_ws(
    ' ',
    ($1).intake_number,
    ($1).customer_mobile,
    ($1).lead_source_name,
    ($1).lead_source_code,
    ($1).status,
    ($1).ocr_fields::text
  );
$function$;

comment on function public.policy_intake_search_text(public.policy_intake_requests)
  is 'Computed text field for scoped Partner Policy Intake PIR/customer/source/insurer OCR search.';

-- Rollback (if necessary):
-- drop function if exists public.policy_intake_search_text(public.policy_intake_requests);
