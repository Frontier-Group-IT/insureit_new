-- Serve the staff KYC queue with server-side search, counts and pagination.

create extension if not exists pg_trgm;

create index if not exists customer_onboarding_applications_status_updated_idx
  on public.customer_onboarding_applications(status, updated_at desc);

create index if not exists customer_onboarding_applications_partner_updated_idx
  on public.customer_onboarding_applications(partner_type, updated_at desc);

create index if not exists customer_onboarding_applications_search_trgm_idx
  on public.customer_onboarding_applications using gin (
    lower(
      coalesce(applicant_phone, '') || ' ' ||
      coalesce(applicant_email, '') || ' ' ||
      coalesce(draft_data->>'contact_name', '') || ' ' ||
      coalesce(draft_data->>'company_name', '') || ' ' ||
      coalesce(draft_data->>'group_name', '') || ' ' ||
      coalesce(draft_data->>'owner_name', '') || ' ' ||
      coalesce(draft_data->>'dealership_name', '') || ' ' ||
      coalesce(draft_data->>'pos_name', '') || ' ' ||
      coalesce(draft_data->>'misp_name', '') || ' ' ||
      coalesce(draft_data->>'dp_name', '') || ' ' ||
      coalesce(draft_data->>'external_onboarding_id', '')
    ) gin_trgm_ops
  );

create or replace function public.get_kyc_application_queue(
  p_query text default null,
  p_partner_type text default null,
  p_status text default null,
  p_source text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  id uuid,
  partner_type text,
  source text,
  status text,
  current_step smallint,
  applicant_phone text,
  applicant_email text,
  customer_id uuid,
  applicant_name text,
  city text,
  state text,
  external_onboarding_id text,
  document_count bigint,
  age_days integer,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as (
    select
      application.id,
      application.partner_type,
      application.source,
      application.status,
      application.current_step,
      application.applicant_phone,
      application.applicant_email,
      application.customer_id,
      coalesce(
        nullif(application.draft_data->>'company_name', ''),
        nullif(application.draft_data->>'group_name', ''),
        nullif(application.draft_data->>'dealership_name', ''),
        nullif(application.draft_data->>'pos_name', ''),
        nullif(application.draft_data->>'misp_name', ''),
        nullif(application.draft_data->>'contact_name', ''),
        nullif(application.draft_data->>'owner_name', ''),
        nullif(application.draft_data->>'dp_name', '')
      ) as applicant_name,
      nullif(application.draft_data->>'city', '') as city,
      nullif(application.draft_data->>'state', '') as state,
      nullif(application.draft_data->>'external_onboarding_id', '') as external_onboarding_id,
      (
        select count(*)
        from public.customer_onboarding_documents document
        where document.application_id = application.id
      ) as document_count,
      greatest(
        0,
        floor(extract(epoch from (now() - coalesce(application.submitted_at, application.created_at))) / 86400)
      )::integer as age_days,
      application.updated_at
    from public.customer_onboarding_applications application
    where (
      nullif(btrim(p_partner_type), '') is null
      or application.partner_type = p_partner_type
      or (p_partner_type = 'posp_misp' and application.partner_type in ('posp', 'misp'))
    )
      and (
        nullif(btrim(p_status), '') is null
        or application.status = p_status
      )
      and (
        nullif(btrim(p_source), '') is null
        or application.source = p_source
      )
      and (
        nullif(btrim(p_query), '') is null
        or lower(
          coalesce(application.applicant_phone, '') || ' ' ||
          coalesce(application.applicant_email, '') || ' ' ||
          coalesce(application.draft_data->>'contact_name', '') || ' ' ||
          coalesce(application.draft_data->>'company_name', '') || ' ' ||
          coalesce(application.draft_data->>'group_name', '') || ' ' ||
          coalesce(application.draft_data->>'owner_name', '') || ' ' ||
          coalesce(application.draft_data->>'dealership_name', '') || ' ' ||
          coalesce(application.draft_data->>'pos_name', '') || ' ' ||
          coalesce(application.draft_data->>'misp_name', '') || ' ' ||
          coalesce(application.draft_data->>'dp_name', '') || ' ' ||
          coalesce(application.draft_data->>'external_onboarding_id', '')
        ) like '%' || lower(btrim(p_query)) || '%'
      )
  )
  select
    filtered.*,
    count(*) over () as total_count
  from filtered
  order by
    case filtered.status
      when 'submitted' then 0
      when 'under_review' then 1
      when 'changes_requested' then 2
      else 3
    end,
    filtered.updated_at desc
  limit least(greatest(coalesce(p_page_size, 25), 1), 100)
  offset (greatest(coalesce(p_page, 1), 1) - 1)
    * least(greatest(coalesce(p_page_size, 25), 1), 100);
$$;

revoke all on function public.get_kyc_application_queue(text, text, text, text, integer, integer) from public;
grant execute on function public.get_kyc_application_queue(text, text, text, text, integer, integer) to authenticated;
grant execute on function public.get_kyc_application_queue(text, text, text, text, integer, integer) to service_role;
