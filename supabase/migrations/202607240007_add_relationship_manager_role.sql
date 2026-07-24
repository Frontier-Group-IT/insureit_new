-- Add Relationship Manager as a valid staff portal role.
-- The enum backing profiles.role is resolved dynamically so this remains safe
-- if the enum type was created under a different internal name.

do $$
declare
  role_type_schema text;
  role_type_name text;
begin
  select namespace.nspname, role_type.typname
    into role_type_schema, role_type_name
  from pg_attribute attribute
  join pg_class profile_table
    on profile_table.oid = attribute.attrelid
  join pg_namespace table_namespace
    on table_namespace.oid = profile_table.relnamespace
  join pg_type role_type
    on role_type.oid = attribute.atttypid
  join pg_namespace namespace
    on namespace.oid = role_type.typnamespace
  where table_namespace.nspname = 'public'
    and profile_table.relname = 'profiles'
    and attribute.attname = 'role'
    and attribute.attnum > 0
    and not attribute.attisdropped
    and role_type.typtype = 'e'
  limit 1;

  if role_type_name is null then
    raise exception 'Could not resolve the enum type used by public.profiles.role';
  end if;

  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    join pg_namespace enum_namespace on enum_namespace.oid = enum_type.typnamespace
    where enum_namespace.nspname = role_type_schema
      and enum_type.typname = role_type_name
      and enum_value.enumlabel = 'relationship_manager'
  ) then
    execute format(
      'alter type %I.%I add value %L',
      role_type_schema,
      role_type_name,
      'relationship_manager'
    );
  end if;
end
$$;
