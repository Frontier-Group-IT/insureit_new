begin;

create or replace function public.admin_hard_delete_blockers(
  p_target_table text,
  p_target_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_target_oid oid;
  v_row record;
  v_count bigint;
  v_result jsonb := '[]'::jsonb;
begin
  if p_target_table not in ('profiles','employees','partners','intermediaries') then
    raise exception 'Unsupported hard-delete target';
  end if;

  select c.oid
    into v_target_oid
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = p_target_table
    and c.relkind = 'r';

  if v_target_oid is null then
    raise exception 'Hard-delete target table not found';
  end if;

  for v_row in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      a.attname as column_name,
      case con.confdeltype
        when 'a' then 'NO ACTION'
        when 'r' then 'RESTRICT'
        else con.confdeltype::text
      end as delete_rule
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a
      on a.attrelid = con.conrelid
     and a.attnum = con.conkey[1]
    where con.contype = 'f'
      and con.confrelid = v_target_oid
      and array_length(con.conkey, 1) = 1
      and con.confdeltype in ('a','r')
  loop
    execute format(
      'select count(*) from %I.%I where %I = $1',
      v_row.schema_name,
      v_row.table_name,
      v_row.column_name
    )
    into v_count
    using p_target_id;

    if v_count > 0 then
      v_result := v_result || jsonb_build_array(
        jsonb_build_object(
          'table', v_row.table_name,
          'column', v_row.column_name,
          'delete_rule', v_row.delete_rule,
          'count', v_count
        )
      );
    end if;
  end loop;

  return v_result;
end;
$$;

revoke all on function public.admin_hard_delete_blockers(text, uuid) from public, anon, authenticated;
grant execute on function public.admin_hard_delete_blockers(text, uuid) to service_role;

commit;
