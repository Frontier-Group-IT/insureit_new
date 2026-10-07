-- Make RLS-enabled/no-policy tables explicitly server-only.
-- RLS already denies anon/authenticated rows; revoking table privileges adds a second boundary
-- and prevents a future policy addition from accidentally exposing these tables without an
-- explicit privilege grant.

begin;

do $$
declare
  table_row record;
begin
  for table_row in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
    group by c.oid, n.nspname, c.relname
    having count(p.oid) = 0
  loop
    execute format(
      'revoke all privileges on table %I.%I from anon, authenticated',
      table_row.schema_name,
      table_row.table_name
    );
  end loop;
end;
$$;

commit;
