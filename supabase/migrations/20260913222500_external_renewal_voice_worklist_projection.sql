begin;

create or replace function public.partner_app_external_renewal_voice_states(p_opportunity_ids uuid[])
returns table (
  opportunity_id uuid,
  voice_state text,
  submission_status text,
  connectivity_status text,
  call_disposition text,
  follow_up_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_ids uuid[] := coalesce(p_opportunity_ids,array[]::uuid[]);
begin
  if cardinality(v_ids) > 100 then
    raise exception 'Too many external renewal opportunity ids';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none')='none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  return query
  select
    o.id,
    case
      when o.opportunity_status in ('won','renewed_elsewhere','invalid_contact','do_not_contact','lost','duplicate') then 'closed'
      when nullif(regexp_replace(coalesce(o.mobile,''),'\D','','g'),'') is null then 'needs_details'
      when a.submission_status in ('created','submitted','queued') then 'queued'
      when a.submission_status='calling' then 'calling'
      when a.connectivity_status='no_answer' then 'no_answer'
      when a.connectivity_status='busy' then 'busy'
      when a.submission_status='failed' or a.connectivity_status='failed' then 'failed'
      when a.connectivity_status='connected' and a.call_disposition='follow_up' and a.follow_up_at is not null then 'follow_up'
      when a.connectivity_status='connected' and a.call_disposition in ('human_assistance','wrong_person','not_interested') then 'human_needed'
      when a.connectivity_status='connected' and a.call_disposition='interested' then 'interested'
      when a.connectivity_status='connected' then 'connected'
      else 'available'
    end as voice_state,
    a.submission_status,
    a.connectivity_status,
    a.call_disposition,
    a.follow_up_at,
    a.updated_at
  from public.external_renewal_opportunities o
  join public.external_renewal_import_batches b on b.id=o.batch_id
  left join lateral (
    select va.*
    from public.external_renewal_voice_attempts va
    where va.opportunity_id=o.id and va.partner_id=o.partner_id
    order by va.created_at desc
    limit 1
  ) a on true
  where o.id=any(v_ids)
    and o.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active;
end;
$$;

revoke all on function public.partner_app_external_renewal_voice_states(uuid[]) from public, anon;
grant execute on function public.partner_app_external_renewal_voice_states(uuid[]) to authenticated, service_role;

commit;
