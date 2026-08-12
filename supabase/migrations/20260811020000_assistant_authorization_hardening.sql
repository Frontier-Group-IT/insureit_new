-- Forward-only hardening for deployments that may already have applied
-- 20260810153000_assistant_knowledge_foundation.sql.

begin;

alter table public.assistant_knowledge_import_rows
  add column if not exists required_access text,
  add column if not exists route_required_permissions jsonb;
alter table public.assistant_knowledge_entries
  add column if not exists required_access text,
  add column if not exists route_required_permissions jsonb;

-- Existing rows predate access-level and route-ancestry governance. Keep their
-- metadata for traceability, but revoke entries until they are re-imported and
-- reviewed under the current controlled template.
update public.assistant_knowledge_import_rows
set required_access = coalesce(required_access, 'approve'),
    route_required_permissions = coalesce(
      route_required_permissions,
      (select jsonb_object_agg(capability, 'approve') from unnest(required_capabilities) as capability)
    )
where required_access is null or route_required_permissions is null;

update public.assistant_knowledge_entries
set required_access = coalesce(required_access, 'approve'),
    route_required_permissions = coalesce(
      route_required_permissions,
      (select jsonb_object_agg(capability, 'approve') from unnest(required_capabilities) as capability)
    ),
    status = 'retired',
    is_revoked = true,
    effective_to = coalesce(effective_to, now()),
    retired_at = coalesce(retired_at, now()),
    updated_at = now()
where required_access is null or route_required_permissions is null;

alter table public.assistant_knowledge_import_rows
  alter column required_access set not null,
  alter column route_required_permissions set not null;
alter table public.assistant_knowledge_entries
  alter column required_access set not null,
  alter column route_required_permissions set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'assistant_import_rows_required_access_check') then
    alter table public.assistant_knowledge_import_rows
      add constraint assistant_import_rows_required_access_check check (required_access in ('view','edit','approve'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assistant_import_rows_route_permissions_check') then
    alter table public.assistant_knowledge_import_rows
      add constraint assistant_import_rows_route_permissions_check check (jsonb_typeof(route_required_permissions) = 'object' and route_required_permissions <> '{}'::jsonb);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assistant_entries_required_access_check') then
    alter table public.assistant_knowledge_entries
      add constraint assistant_entries_required_access_check check (required_access in ('view','edit','approve'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'assistant_entries_route_permissions_check') then
    alter table public.assistant_knowledge_entries
      add constraint assistant_entries_route_permissions_check check (jsonb_typeof(route_required_permissions) = 'object' and route_required_permissions <> '{}'::jsonb);
  end if;
end
$$;

create index if not exists assistant_usage_events_request_idx
  on public.assistant_usage_events(request_id, created_at);

drop function if exists public.search_approved_assistant_knowledge(text, integer);
drop function if exists public.search_approved_assistant_knowledge(text, text[], integer);
drop function if exists public.search_approved_assistant_knowledge(text, jsonb, integer);
create function public.search_approved_assistant_knowledge(p_query text, p_capability_access jsonb, p_limit integer default 5)
returns table (
  source_id uuid,
  title text,
  excerpt text,
  internal_path text,
  required_capabilities text[],
  required_access text,
  route_required_permissions jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    entry.id,
    entry.title,
    left(entry.content, 2000),
    entry.route,
    entry.required_capabilities,
    entry.required_access,
    entry.route_required_permissions
  from public.assistant_knowledge_entries entry
  where length(trim(coalesce(p_query, ''))) between 1 and 500
    and entry.status = 'published'
    and entry.is_revoked = false
    and not exists (
      select 1
      from unnest(entry.required_capabilities) as required_capability
      where case coalesce(p_capability_access->>required_capability, 'none')
              when 'approve' then 3 when 'edit' then 2 when 'view' then 1 else 0
            end
            < case entry.required_access when 'approve' then 3 when 'edit' then 2 else 1 end
    )
    and not exists (
      select 1
      from jsonb_each_text(entry.route_required_permissions) as route_requirement(capability, minimum_access)
      where route_requirement.minimum_access not in ('view','edit','approve')
         or case coalesce(p_capability_access->>route_requirement.capability, 'none')
              when 'approve' then 3 when 'edit' then 2 when 'view' then 1 else 0
            end
            < case route_requirement.minimum_access when 'approve' then 3 when 'edit' then 2 when 'view' then 1 else 4 end
    )
    and (entry.effective_from is null or entry.effective_from <= now())
    and (entry.effective_to is null or entry.effective_to > now())
    and entry.search_document @@ websearch_to_tsquery('english'::regconfig, left(trim(p_query), 500))
  order by ts_rank(entry.search_document, websearch_to_tsquery('english'::regconfig, left(trim(p_query), 500))) desc,
           entry.updated_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

revoke all on function public.search_approved_assistant_knowledge(text, jsonb, integer) from public, anon, authenticated;
grant execute on function public.search_approved_assistant_knowledge(text, jsonb, integer) to service_role;

create or replace function public.stage_assistant_knowledge_import(p_import jsonb, p_entries jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_import_id uuid;
  v_import_row_id uuid;
  v_entry jsonb;
  v_count integer;
begin
  if jsonb_typeof(p_import) <> 'object' or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'invalid_assistant_knowledge_import';
  end if;
  v_count := jsonb_array_length(p_entries);
  if v_count < 1 or v_count > 1000 then raise exception 'invalid_assistant_knowledge_entry_count'; end if;

  insert into public.assistant_knowledge_imports (
    file_name, file_sha256, template_version, content_version, knowledge_base_name,
    owner_label, classification, status, total_rows, valid_rows, invalid_rows,
    created_by, completed_at
  ) values (
    p_import->>'file_name', p_import->>'file_sha256', p_import->>'template_version',
    (p_import->>'content_version')::integer, p_import->>'knowledge_base_name',
    p_import->>'owner_label', p_import->>'classification', 'completed', v_count, v_count, 0,
    (p_import->>'created_by')::uuid, now()
  ) returning id into v_import_id;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if (v_entry->>'required_access') not in ('view','edit','approve')
       or jsonb_typeof(v_entry->'route_required_permissions') <> 'object'
       or v_entry->'route_required_permissions' = '{}'::jsonb
       or exists (
         select 1 from jsonb_each_text(v_entry->'route_required_permissions') as requirement(capability, minimum_access)
         where requirement.minimum_access not in ('view','edit','approve')
       ) then
      raise exception 'invalid_assistant_knowledge_access_contract';
    end if;

    insert into public.assistant_knowledge_import_rows (
      import_id, row_number, route, title, content, tags, source_reference,
      required_capabilities, required_access, route_required_permissions, status, validation_errors
    ) values (
      v_import_id, (v_entry->>'row_number')::integer, v_entry->>'route', v_entry->>'title',
      v_entry->>'content', array(select jsonb_array_elements_text(coalesce(v_entry->'tags', '[]'::jsonb))),
      v_entry->>'source_reference', array(select jsonb_array_elements_text(v_entry->'required_capabilities')),
      v_entry->>'required_access', v_entry->'route_required_permissions', 'imported', '{}'::text[]
    ) returning id into v_import_row_id;

    insert into public.assistant_knowledge_entries (
      import_id, import_row_id, route, title, content, tags, source_reference,
      required_capabilities, required_access, route_required_permissions,
      version, status, is_revoked, created_by, updated_by
    ) values (
      v_import_id, v_import_row_id, v_entry->>'route', v_entry->>'title', v_entry->>'content',
      array(select jsonb_array_elements_text(coalesce(v_entry->'tags', '[]'::jsonb))),
      v_entry->>'source_reference', array(select jsonb_array_elements_text(v_entry->'required_capabilities')),
      v_entry->>'required_access', v_entry->'route_required_permissions',
      (p_import->>'content_version')::integer, 'draft', false,
      (p_import->>'created_by')::uuid, (p_import->>'created_by')::uuid
    );
  end loop;
  return v_import_id;
end;
$$;

revoke all on function public.stage_assistant_knowledge_import(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.stage_assistant_knowledge_import(jsonb, jsonb) to service_role;

-- SECURITY INVOKER RPCs and trusted server-only admin operations need explicit,
-- minimum table privileges; RLS bypass alone does not grant SQL privileges.
revoke all on table public.assistant_knowledge_imports from service_role;
revoke all on table public.assistant_knowledge_import_rows from service_role;
revoke all on table public.assistant_knowledge_entries from service_role;
revoke all on table public.assistant_usage_events from service_role;
revoke all on table public.assistant_request_limits from service_role;
grant select, insert on table public.assistant_knowledge_imports to service_role;
grant select, insert on table public.assistant_knowledge_import_rows to service_role;
grant select, insert, update on table public.assistant_knowledge_entries to service_role;
grant insert on table public.assistant_usage_events to service_role;
grant select, insert, update on table public.assistant_request_limits to service_role;

commit;
