begin;

create or replace function public.partner_app_record_external_renewal_interaction(
  p_opportunity_id uuid,
  p_interaction_type text,
  p_outcome text,
  p_note text default null,
  p_follow_up_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_partner_id uuid;
  v_current_status text;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  if p_interaction_type not in ('call','whatsapp','note','follow_up') then
    raise exception 'Invalid interaction type';
  end if;

  if p_outcome not in ('contact_attempted','connected','interested','quote_requested','quote_shared','follow_up','renewed_elsewhere','invalid_contact','do_not_contact','lost') then
    raise exception 'Invalid interaction outcome';
  end if;

  if v_note is not null and char_length(v_note) > 4000 then
    raise exception 'Interaction note is too long';
  end if;

  if p_outcome='follow_up' and p_follow_up_at is null then
    raise exception 'Follow-up date is required';
  end if;

  if p_follow_up_at is not null and p_follow_up_at < now() - interval '5 minutes' then
    raise exception 'Follow-up date cannot be in the past';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select o.partner_id, o.opportunity_status
  into v_partner_id, v_current_status
  from public.external_renewal_opportunities o
  join public.external_renewal_import_batches b on b.id=o.batch_id
  where o.id=p_opportunity_id
    and o.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active
  for update;

  if v_partner_id is null then
    raise exception 'External renewal opportunity is unavailable' using errcode='P0002';
  end if;

  if v_current_status in ('won','renewed_elsewhere','invalid_contact','do_not_contact','lost') then
    raise exception 'This external renewal opportunity is closed and cannot accept further CRM updates';
  end if;

  v_status := case p_outcome
    when 'contact_attempted' then 'contact_attempted'
    when 'connected' then 'connected'
    when 'interested' then 'interested'
    when 'quote_requested' then 'quote_requested'
    when 'quote_shared' then 'quote_shared'
    when 'follow_up' then 'follow_up'
    when 'renewed_elsewhere' then 'renewed_elsewhere'
    when 'invalid_contact' then 'invalid_contact'
    when 'do_not_contact' then 'do_not_contact'
    when 'lost' then 'lost'
    else 'new'
  end;

  insert into public.external_renewal_interactions (
    opportunity_id, partner_id, interaction_type, outcome, note, follow_up_at, created_by_auth_user_id
  ) values (
    p_opportunity_id, v_partner_id, p_interaction_type, p_outcome, v_note, p_follow_up_at, auth.uid()
  );

  update public.external_renewal_opportunities
  set opportunity_status=v_status,
      last_interaction_at=now(),
      next_follow_up_at=p_follow_up_at,
      updated_at=now()
  where id=p_opportunity_id and partner_id=v_partner_id;

  return public.partner_app_external_renewal_detail(p_opportunity_id);
end;
$$;

revoke all on function public.partner_app_record_external_renewal_interaction(uuid,text,text,text,timestamptz) from public, anon;
grant execute on function public.partner_app_record_external_renewal_interaction(uuid,text,text,text,timestamptz) to authenticated, service_role;

commit;
