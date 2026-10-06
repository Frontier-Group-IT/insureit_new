begin;

create schema if not exists insureit_control;
revoke all on schema insureit_control from public, anon, authenticated;

create table if not exists public.developer_config_registry (
  key text primary key,
  app text not null check (app in ('portal','partner','customer','tech')),
  section text not null,
  label text not null,
  value_type text not null check (value_type in ('text','boolean','image-reference','select')),
  description text not null,
  validation jsonb not null default '{}'::jsonb,
  preview_enabled boolean not null default false,
  consumer_status text not null default 'not_connected' check (consumer_status in ('not_connected','preview_only','connected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.developer_config_revisions (
  id uuid primary key default gen_random_uuid(),
  config_key text not null references public.developer_config_registry(key) on delete restrict,
  revision bigint not null,
  value jsonb not null,
  state text not null default 'draft' check (state in ('draft','rollback_draft','published','superseded')),
  change_note text,
  source_revision_id uuid null references public.developer_config_revisions(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (config_key, revision)
);

create index if not exists developer_config_revisions_key_created_idx
  on public.developer_config_revisions(config_key, created_at desc);
create index if not exists developer_config_revisions_created_by_idx
  on public.developer_config_revisions(created_by);
create index if not exists developer_config_revisions_source_revision_idx
  on public.developer_config_revisions(source_revision_id)
  where source_revision_id is not null;

create table if not exists public.developer_config_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('draft_created','rollback_preview_created')),
  config_key text not null references public.developer_config_registry(key) on delete restrict,
  revision_id uuid not null references public.developer_config_revisions(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists developer_config_audit_key_created_idx
  on public.developer_config_audit(config_key, created_at desc);
create index if not exists developer_config_audit_actor_idx
  on public.developer_config_audit(actor_id);
create index if not exists developer_config_audit_revision_idx
  on public.developer_config_audit(revision_id);

alter table public.developer_config_registry enable row level security;
alter table public.developer_config_revisions enable row level security;
alter table public.developer_config_audit enable row level security;

drop policy if exists "developer config registry it read" on public.developer_config_registry;
create policy "developer config registry it read"
on public.developer_config_registry for select to authenticated
using (
  (select auth.uid()) is not null
  and (select public.current_app_role())::text = 'it_super_user'
);

drop policy if exists "developer config revisions it read" on public.developer_config_revisions;
create policy "developer config revisions it read"
on public.developer_config_revisions for select to authenticated
using (
  (select auth.uid()) is not null
  and (select public.current_app_role())::text = 'it_super_user'
);

drop policy if exists "developer config revisions aal2 draft insert" on public.developer_config_revisions;
create policy "developer config revisions aal2 draft insert"
on public.developer_config_revisions for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select public.current_app_role())::text = 'it_super_user'
  and (select auth.jwt()->>'aal') = 'aal2'
  and created_by = (select auth.uid())
  and state in ('draft','rollback_draft')
);

drop policy if exists "developer config audit it read" on public.developer_config_audit;
create policy "developer config audit it read"
on public.developer_config_audit for select to authenticated
using (
  (select auth.uid()) is not null
  and (select public.current_app_role())::text = 'it_super_user'
);

revoke all on public.developer_config_registry from anon, authenticated;
revoke all on public.developer_config_revisions from anon, authenticated;
revoke all on public.developer_config_audit from anon, authenticated;
grant select on public.developer_config_registry to authenticated;
grant select, insert on public.developer_config_revisions to authenticated;
grant select on public.developer_config_audit to authenticated;

create or replace function insureit_control.prepare_developer_config_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  registry_row public.developer_config_registry%rowtype;
  max_length integer;
  source_row public.developer_config_revisions%rowtype;
begin
  if auth.uid() is null
     or public.current_app_role()::text <> 'it_super_user'
     or coalesce(auth.jwt()->>'aal','') <> 'aal2' then
    raise exception 'AAL2 IT Super User authentication is required.'
      using errcode = '42501';
  end if;

  select * into registry_row
  from public.developer_config_registry
  where key = new.config_key
  for update;

  if registry_row.key is null then
    raise exception 'Unknown developer configuration key.' using errcode = '22023';
  end if;

  if not registry_row.preview_enabled then
    raise exception 'This configuration key is not enabled for draft preview.' using errcode = '42501';
  end if;

  if new.state not in ('draft','rollback_draft') then
    raise exception 'Only draft revisions can be created.' using errcode = '42501';
  end if;

  if new.state = 'rollback_draft' then
    if new.source_revision_id is null then
      raise exception 'Rollback preview requires a source revision.' using errcode = '22023';
    end if;

    select * into source_row
    from public.developer_config_revisions
    where id = new.source_revision_id and config_key = new.config_key;

    if source_row.id is null then
      raise exception 'Rollback source revision was not found for this key.' using errcode = '22023';
    end if;

    new.value := source_row.value;
  end if;

  if registry_row.value_type in ('text','image-reference','select') then
    if jsonb_typeof(new.value) <> 'string' then
      raise exception 'Configuration value must be a JSON string.' using errcode = '22023';
    end if;

    max_length := nullif(registry_row.validation->>'maxLength','')::integer;
    if max_length is not null and length(new.value #>> '{}') > max_length then
      raise exception 'Configuration value exceeds the allowed length.' using errcode = '22023';
    end if;
  elsif registry_row.value_type = 'boolean' then
    if jsonb_typeof(new.value) <> 'boolean' then
      raise exception 'Configuration value must be a JSON boolean.' using errcode = '22023';
    end if;
  end if;

  new.created_by := auth.uid();
  select coalesce(max(revision), 0) + 1 into new.revision
  from public.developer_config_revisions
  where config_key = new.config_key;

  return new;
end;
$$;

revoke all on function insureit_control.prepare_developer_config_revision() from public, anon, authenticated;

drop trigger if exists prepare_developer_config_revision on public.developer_config_revisions;
create trigger prepare_developer_config_revision
before insert on public.developer_config_revisions
for each row execute function insureit_control.prepare_developer_config_revision();

create or replace function insureit_control.audit_developer_config_revision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is null then
    raise exception 'Developer configuration audit actor is required.';
  end if;

  insert into public.developer_config_audit (
    actor_id, action, config_key, revision_id, details
  ) values (
    new.created_by,
    case when new.state = 'rollback_draft' then 'rollback_preview_created' else 'draft_created' end,
    new.config_key,
    new.id,
    jsonb_build_object(
      'revision', new.revision,
      'state', new.state,
      'source_revision_id', new.source_revision_id,
      'change_note', new.change_note
    )
  );

  return new;
end;
$$;

revoke all on function insureit_control.audit_developer_config_revision() from public, anon, authenticated;

drop trigger if exists audit_developer_config_revision on public.developer_config_revisions;
create trigger audit_developer_config_revision
after insert on public.developer_config_revisions
for each row execute function insureit_control.audit_developer_config_revision();

create or replace function insureit_control.block_developer_config_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Developer configuration revisions and audit records are append-only.'
    using errcode = '42501';
end;
$$;

revoke all on function insureit_control.block_developer_config_mutation() from public, anon, authenticated;

drop trigger if exists block_developer_config_revision_mutation on public.developer_config_revisions;
create trigger block_developer_config_revision_mutation
before update or delete on public.developer_config_revisions
for each row execute function insureit_control.block_developer_config_mutation();

drop trigger if exists block_developer_config_audit_mutation on public.developer_config_audit;
create trigger block_developer_config_audit_mutation
before update or delete on public.developer_config_audit
for each row execute function insureit_control.block_developer_config_mutation();

insert into public.developer_config_registry
  (key, app, section, label, value_type, description, validation, preview_enabled, consumer_status)
values
  ('portal.ui.announcement','portal','Content','Portal announcement','text','Non-critical portal announcement banner text', '{"maxLength":160}'::jsonb, false, 'not_connected'),
  ('portal.support.help_url','portal','Support','Help URL','text','Help-center destination; no authentication or security override', '{"maxLength":500}'::jsonb, false, 'not_connected'),
  ('partner.home.announcement','partner','Home','Home announcement','text','Partner app home announcement text', '{"maxLength":140}'::jsonb, false, 'not_connected'),
  ('partner.home.banner_asset','partner','Branding','Banner artwork','image-reference','Canonical approved banner asset reference', '{"maxLength":240}'::jsonb, false, 'not_connected'),
  ('customer.home.announcement','customer','Home','Home announcement','text','Customer app home announcement text', '{"maxLength":140}'::jsonb, false, 'not_connected'),
  ('customer.support.help_url','customer','Support','Support link','text','Customer support destination', '{"maxLength":500}'::jsonb, false, 'not_connected'),
  ('tech.site.hero_subtitle','tech','Public Site','Hero subtitle','text','Public InsureIT Tech hero supporting copy', '{"maxLength":240}'::jsonb, true, 'preview_only'),
  ('tech.site.show_engineering_links','tech','Public Site','Engineering links visibility','boolean','Visibility of public engineering resource links', '{}'::jsonb, false, 'not_connected')
on conflict (key) do update
set app = excluded.app,
    section = excluded.section,
    label = excluded.label,
    value_type = excluded.value_type,
    description = excluded.description,
    validation = excluded.validation,
    preview_enabled = excluded.preview_enabled,
    consumer_status = excluded.consumer_status,
    updated_at = now();

commit;
