-- INSUREIT assistant Phase 1 knowledge/import/audit foundation.
-- ADDITIVE ONLY. Legacy permission resolution remains authoritative; the V2
-- catalogue rows below are shadow metadata and do not grant or enforce access.

begin;

create table if not exists public.assistant_knowledge_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  template_version text not null,
  content_version integer not null check (content_version > 0),
  knowledge_base_name text not null,
  owner_label text not null,
  classification text not null check (classification = 'internal'),
  status text not null default 'validated' check (status in ('validated','importing','completed','failed','cancelled')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint assistant_knowledge_import_counts check (valid_rows + invalid_rows <= total_rows)
);

create table if not exists public.assistant_knowledge_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.assistant_knowledge_imports(id) on delete cascade,
  row_number integer not null check (row_number >= 2),
  route text not null,
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  source_reference text not null,
  required_capabilities text[] not null check (cardinality(required_capabilities) > 0),
  status text not null check (status in ('valid','invalid','imported','rejected')),
  validation_errors text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(import_id, row_number)
);

create table if not exists public.assistant_knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  import_id uuid null references public.assistant_knowledge_imports(id) on delete set null,
  import_row_id uuid null references public.assistant_knowledge_import_rows(id) on delete set null,
  route text not null check (route ~ '^/[a-z0-9]+([/-][a-z0-9]+)*$'),
  title text not null,
  content text not null,
  tags text[] not null default '{}',
  source_reference text not null,
  required_capabilities text[] not null check (cardinality(required_capabilities) > 0),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','published','retired')),
  effective_from timestamptz null,
  effective_to timestamptz null,
  is_revoked boolean not null default false,
  published_by uuid null references public.profiles(id) on delete set null,
  published_at timestamptz null,
  retired_by uuid null references public.profiles(id) on delete set null,
  retired_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint assistant_knowledge_effective_window check (effective_to is null or effective_from is null or effective_to > effective_from),
  search_document tsvector generated always as (
    to_tsvector('english'::regconfig, coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(source_reference, ''))
  ) stored,
  unique(route, title, version)
);

create table if not exists public.assistant_usage_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid null references public.profiles(id) on delete set null,
  request_id uuid not null default gen_random_uuid(),
  capability text not null,
  decision text not null check (decision in ('allowed','denied','error')),
  tool_name text null,
  route text null,
  row_count integer null check (row_count is null or row_count >= 0),
  latency_ms integer null check (latency_ms is null or latency_ms >= 0),
  error_code text null,
  created_at timestamptz not null default now()
);

create table if not exists public.assistant_request_limits (
  actor_profile_id uuid primary key references public.profiles(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  active_lease_id uuid null,
  active_until timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists assistant_knowledge_imports_created_at_idx on public.assistant_knowledge_imports(created_at desc);
create index if not exists assistant_knowledge_import_rows_import_idx on public.assistant_knowledge_import_rows(import_id, row_number);
create index if not exists assistant_knowledge_entries_status_route_idx on public.assistant_knowledge_entries(status, route);
create unique index if not exists assistant_knowledge_entries_one_published_idx on public.assistant_knowledge_entries(route, title) where status = 'published' and is_revoked = false;
create index if not exists assistant_knowledge_entries_search_idx on public.assistant_knowledge_entries using gin(search_document);
create index if not exists assistant_usage_events_actor_created_idx on public.assistant_usage_events(actor_profile_id, created_at desc);
create index if not exists assistant_usage_events_created_at_idx on public.assistant_usage_events(created_at desc);

drop function if exists public.search_approved_assistant_knowledge(text, integer);
create or replace function public.search_approved_assistant_knowledge(p_query text, p_capabilities text[], p_limit integer default 5)
returns table (
  source_id uuid,
  title text,
  excerpt text,
  internal_path text,
  required_capabilities text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    entry.id as source_id,
    entry.title,
    left(entry.content, 2000) as excerpt,
    entry.route as internal_path,
    entry.required_capabilities
  from public.assistant_knowledge_entries entry
  where length(trim(coalesce(p_query, ''))) between 1 and 500
    and entry.status = 'published'
    and entry.is_revoked = false
    and entry.required_capabilities <@ coalesce(p_capabilities, '{}'::text[])
    and (entry.effective_from is null or entry.effective_from <= now())
    and (entry.effective_to is null or entry.effective_to > now())
    and entry.search_document @@ websearch_to_tsquery('english'::regconfig, left(trim(p_query), 500))
  order by ts_rank(entry.search_document, websearch_to_tsquery('english'::regconfig, left(trim(p_query), 500))) desc,
           entry.updated_at desc
  limit least(greatest(coalesce(p_limit, 5), 1), 5);
$$;

revoke all on function public.search_approved_assistant_knowledge(text, text[], integer) from public, anon, authenticated;
grant execute on function public.search_approved_assistant_knowledge(text, text[], integer) to service_role;

create or replace function public.acquire_assistant_request_lease(p_actor_profile_id uuid)
returns table (status text, lease_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_limit public.assistant_request_limits%rowtype;
  v_now timestamptz := now();
  v_lease_id uuid := gen_random_uuid();
begin
  insert into public.assistant_request_limits(actor_profile_id)
    values (p_actor_profile_id) on conflict (actor_profile_id) do nothing;
  select * into v_limit from public.assistant_request_limits
    where actor_profile_id = p_actor_profile_id for update;
  if v_limit.window_started_at <= v_now - interval '60 seconds' then
    v_limit.window_started_at := v_now;
    v_limit.request_count := 0;
  end if;
  if v_limit.active_until is not null and v_limit.active_until > v_now then
    return query select 'concurrency'::text, null::uuid;
    return;
  end if;
  if v_limit.request_count >= 20 then
    return query select 'rate'::text, null::uuid;
    return;
  end if;
  update public.assistant_request_limits
    set window_started_at = v_limit.window_started_at,
        request_count = v_limit.request_count + 1,
        active_lease_id = v_lease_id,
        active_until = v_now + interval '90 seconds',
        updated_at = v_now
    where actor_profile_id = p_actor_profile_id;
  return query select 'allowed'::text, v_lease_id;
end;
$$;

revoke all on function public.acquire_assistant_request_lease(uuid) from public, anon, authenticated;
grant execute on function public.acquire_assistant_request_lease(uuid) to service_role;

create or replace function public.release_assistant_request_lease(p_actor_profile_id uuid, p_lease_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  update public.assistant_request_limits
    set active_lease_id = null, active_until = null, updated_at = now()
    where actor_profile_id = p_actor_profile_id and active_lease_id = p_lease_id
  returning true;
$$;

revoke all on function public.release_assistant_request_lease(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_assistant_request_lease(uuid, uuid) to service_role;

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
    insert into public.assistant_knowledge_import_rows (
      import_id, row_number, route, title, content, tags, source_reference,
      required_capabilities, status, validation_errors
    ) values (
      v_import_id, (v_entry->>'row_number')::integer, v_entry->>'route', v_entry->>'title',
      v_entry->>'content', array(select jsonb_array_elements_text(coalesce(v_entry->'tags', '[]'::jsonb))),
      v_entry->>'source_reference', array(select jsonb_array_elements_text(v_entry->'required_capabilities')),
      'imported', '{}'::text[]
    ) returning id into v_import_row_id;

    insert into public.assistant_knowledge_entries (
      import_id, import_row_id, route, title, content, tags, source_reference,
      required_capabilities, version, status, is_revoked, created_by, updated_by
    ) values (
      v_import_id, v_import_row_id, v_entry->>'route', v_entry->>'title', v_entry->>'content',
      array(select jsonb_array_elements_text(coalesce(v_entry->'tags', '[]'::jsonb))),
      v_entry->>'source_reference', array(select jsonb_array_elements_text(v_entry->'required_capabilities')),
      (p_import->>'content_version')::integer, 'draft', false,
      (p_import->>'created_by')::uuid, (p_import->>'created_by')::uuid
    );
  end loop;
  return v_import_id;
end;
$$;

revoke all on function public.stage_assistant_knowledge_import(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.stage_assistant_knowledge_import(jsonb, jsonb) to service_role;

create or replace function public.transition_assistant_knowledge_entry(p_entry_id uuid, p_action text, p_actor_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_action = 'publish' then
    update public.assistant_knowledge_entries
      set status = 'published', is_revoked = false, published_by = p_actor_id,
          published_at = v_now, retired_by = null, retired_at = null,
          effective_from = v_now, updated_by = p_actor_id, updated_at = v_now
      where id = p_entry_id and status = 'draft';
  elsif p_action = 'retire' then
    update public.assistant_knowledge_entries
      set status = 'retired', is_revoked = true, retired_by = p_actor_id,
          retired_at = v_now, effective_to = v_now, updated_by = p_actor_id, updated_at = v_now
      where id = p_entry_id and status = 'published' and is_revoked = false;
  else
    raise exception 'invalid_assistant_knowledge_transition';
  end if;
  if not found then return false; end if;

  insert into public.assistant_usage_events (
    actor_profile_id, capability, decision, tool_name, route, row_count, latency_ms, error_code
  ) values (
    p_actor_id, 'manage_assistant_knowledge', 'allowed',
    case when p_action = 'publish' then 'assistant_knowledge_publish' else 'assistant_knowledge_retire' end,
    '/system/assistant-knowledge', 1, 0, null
  );
  return true;
end;
$$;

revoke all on function public.transition_assistant_knowledge_entry(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_assistant_knowledge_entry(uuid, text, uuid) to service_role;

-- Deny by default: Phase 1 exposes no client policy. Trusted server code must
-- still perform authoritative legacy permission checks before service-role use.
alter table public.assistant_knowledge_imports enable row level security;
alter table public.assistant_knowledge_import_rows enable row level security;
alter table public.assistant_knowledge_entries enable row level security;
alter table public.assistant_usage_events enable row level security;
alter table public.assistant_request_limits enable row level security;

revoke all on table public.assistant_knowledge_imports from anon, authenticated;
revoke all on table public.assistant_knowledge_import_rows from anon, authenticated;
revoke all on table public.assistant_knowledge_entries from anon, authenticated;
revoke all on table public.assistant_usage_events from anon, authenticated;
revoke all on table public.assistant_request_limits from anon, authenticated;

comment on table public.assistant_knowledge_imports is 'Controlled assistant workbook import metadata; deny-by-default RLS.';
comment on table public.assistant_knowledge_import_rows is 'Validated assistant workbook rows; populated only after application-layer content screening.';
comment on table public.assistant_knowledge_entries is 'Publishable internal assistant knowledge with PostgreSQL full-text search.';
comment on table public.assistant_usage_events is 'Metadata-only assistant authorization/tool audit events. Never store prompts, answers or record bodies.';

-- Shadow catalogue parity only. No V2 role grants or assignments are created.
insert into public.access_permissions_v2
  (permission_key,module,label,description,risk,allowed_access_levels,allowed_scopes,scope_required,is_active)
values
  ('assistant.use','Assistant','Use assistant','Shadow equivalent for internal assistant use; legacy authorization remains authoritative.','sensitive',array['view'],array['self','team','hierarchy','branch','zone','department','vertical','selected_locations','selected_employees','organization'],true,true),
  ('assistant.knowledge.manage','Assistant','Manage assistant knowledge','Shadow equivalent for controlled assistant knowledge administration; legacy authorization remains authoritative.','critical',array['approve'],array['organization'],false,true)
on conflict (permission_key) do update set
  module = excluded.module,
  label = excluded.label,
  description = excluded.description,
  risk = excluded.risk,
  allowed_access_levels = excluded.allowed_access_levels,
  allowed_scopes = excluded.allowed_scopes,
  scope_required = excluded.scope_required,
  is_active = excluded.is_active,
  updated_at = now();

commit;
