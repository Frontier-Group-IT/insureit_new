-- Read-only verification for intermediary register/application consistency.

-- 1. Every register row must have a live application and its type must match
--    the application's account_context.
select
  i.id as intermediary_id,
  i.application_id,
  i.intermediary_type,
  i.intermediary_code,
  i.onboarding_id,
  i.display_name,
  case
    when a.id is null then 'missing_application'
    when i.intermediary_type is distinct from
      case
        when coalesce(a.draft_data ->> 'account_context', '') in ('posp', 'misp')
          then a.draft_data ->> 'account_context'
        else 'partner'
      end
      then 'type_context_mismatch'
    else 'ok'
  end as consistency_status
from public.intermediaries i
left join public.intermediary_onboarding_applications a
  on a.id = i.application_id
where a.id is null
   or i.intermediary_type is distinct from
      case
        when coalesce(a.draft_data ->> 'account_context', '') in ('posp', 'misp')
          then a.draft_data ->> 'account_context'
        else 'partner'
      end
order by i.display_name, i.intermediary_type;

-- 2. A single application must not own more than one register row of its
--    effective account type.
select
  a.id as application_id,
  case
    when coalesce(a.draft_data ->> 'account_context', '') in ('posp', 'misp')
      then a.draft_data ->> 'account_context'
    else 'partner'
  end as effective_account_type,
  count(*) as matching_register_rows,
  array_agg(i.id order by i.created_at) as intermediary_ids,
  array_agg(i.intermediary_code order by i.created_at) as intermediary_codes
from public.intermediary_onboarding_applications a
join public.intermediaries i
  on i.application_id = a.id
 and i.intermediary_type = case
    when coalesce(a.draft_data ->> 'account_context', '') in ('posp', 'misp')
      then a.draft_data ->> 'account_context'
    else 'partner'
  end
group by a.id, effective_account_type
having count(*) <> 1
order by a.id;

-- 3. Permanent register codes must not be duplicated.
select
  upper(trim(i.intermediary_code)) as permanent_code,
  count(*) as row_count,
  array_agg(i.id order by i.created_at) as intermediary_ids,
  array_agg(i.application_id order by i.created_at) as application_ids,
  array_agg(i.intermediary_type order by i.created_at) as intermediary_types
from public.intermediaries i
where nullif(trim(i.intermediary_code), '') is not null
  and i.intermediary_code not like 'PENDING-%'
group by upper(trim(i.intermediary_code))
having count(*) > 1
order by permanent_code;

-- 4. Review rows archived by the consistency cleanup migration.
select
  cleanup_reason,
  count(*) as cleaned_rows,
  min(cleaned_at) as first_cleaned_at,
  max(cleaned_at) as last_cleaned_at
from public.intermediary_register_cleanup_audit
group by cleanup_reason
order by cleanup_reason;
