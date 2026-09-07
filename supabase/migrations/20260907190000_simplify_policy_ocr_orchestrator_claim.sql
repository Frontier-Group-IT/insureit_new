create or replace function public.claim_policy_ocr_orchestrator_samples(
  p_orchestrator_id uuid,
  p_limit integer default 25,
  p_lease_minutes integer default 4
)
returns table (
  sample_id uuid,
  orchestrator_id uuid,
  iteration_no integer,
  label_id uuid,
  policy_document_id uuid,
  file_name text,
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size bigint,
  lease_token uuid,
  attempt_count integer
)
language sql
security definer
set search_path = public
as $$
  with active as (
    select id, iteration_no, insurer_limit
    from public.policy_ocr_training_orchestrators
    where id = p_orchestrator_id
      and status = 'running'
  ),
  insurer_volume as (
    select coalesce(nullif(trim(ic.name), ''), 'Unknown insurer') as insurer_name,
           count(*)::integer as volume
    from public.policy_documents d
    join public.policy_ocr_training_labels l on l.policy_document_id = d.id
    left join public.policies p on p.id = d.policy_id
    left join public.insurance_companies ic on ic.id = p.insurance_company_id
    where d.document_type = 'policy_copy'
      and l.processing_status in ('pending', 'failed')
    group by 1
    order by volume desc, insurer_name
    limit (select insurer_limit from active)
  ),
  ranked as (
    select d.id as policy_document_id,
           l.id as label_id,
           coalesce(nullif(trim(ic.name), ''), 'Unknown insurer') as insurer_name,
           coalesce(nullif(trim(p.policy_type), ''), 'Unknown product') as product_family,
           coalesce(nullif(trim(l.parser_id), ''), 'unknown_layout') as layout_family,
           v.volume,
           row_number() over (
             partition by coalesce(nullif(trim(ic.name), ''), 'Unknown insurer'),
                          coalesce(nullif(trim(p.policy_type), ''), 'Unknown product'),
                          coalesce(nullif(trim(l.parser_id), ''), 'unknown_layout')
             order by d.created_at asc, d.id
           ) as family_rank
    from public.policy_documents d
    join public.policy_ocr_training_labels l on l.policy_document_id = d.id
    left join public.policies p on p.id = d.policy_id
    left join public.insurance_companies ic on ic.id = p.insurance_company_id
    join insurer_volume v
      on v.insurer_name = coalesce(nullif(trim(ic.name), ''), 'Unknown insurer')
    where d.document_type = 'policy_copy'
      and l.processing_status in ('pending', 'failed')
      and l.processing_attempts < 3
      and not exists (
        select 1
        from public.policy_ocr_training_samples s
        where s.orchestrator_id = p_orchestrator_id
          and s.training_label_id = l.id
      )
  ),
  selected as (
    select r.*, a.iteration_no
    from ranked r
    cross join active a
    order by r.volume desc, r.insurer_name, r.product_family, r.layout_family, r.family_rank
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ),
  inserted as (
    insert into public.policy_ocr_training_samples (
      orchestrator_id,
      training_label_id,
      insurer_name,
      product_family,
      layout_family,
      sample_kind,
      status,
      attempt_count,
      lease_token,
      lease_expires_at
    )
    select p_orchestrator_id,
           s.label_id,
           s.insurer_name,
           s.product_family,
           s.layout_family,
           case when s.family_rank <= 3 then 'fresh_sibling' else 'train' end,
           'processing',
           1,
           gen_random_uuid(),
           now() + make_interval(mins => greatest(2, least(coalesce(p_lease_minutes, 4), 10)))
    from selected s
    on conflict (orchestrator_id, training_label_id) do nothing
    returning id, orchestrator_id, training_label_id, lease_token, attempt_count
  )
  select i.id,
         i.orchestrator_id,
         s.iteration_no,
         i.training_label_id,
         d.id,
         d.file_name,
         d.storage_bucket,
         d.storage_path,
         d.mime_type,
         d.file_size,
         i.lease_token,
         i.attempt_count
  from inserted i
  join selected s on s.label_id = i.training_label_id
  join public.policy_documents d on d.id = s.policy_document_id;
$$;

revoke all on function public.claim_policy_ocr_orchestrator_samples(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_policy_ocr_orchestrator_samples(uuid, integer, integer) to service_role;
