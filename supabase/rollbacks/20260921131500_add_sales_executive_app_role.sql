-- Operational rollback for Sales Executive role rollout.
--
-- PostgreSQL does not safely support DROP VALUE on an enum in place. The safe
-- rollback is therefore:
--   1. prevent rollback while profiles still use the role;
--   2. revert the application/permission code;
--   3. leave the now-unused enum label dormant.
--
-- This avoids destructive enum recreation across dependent tables/functions.
-- Before running this rollback, reassign or deactivate every Sales Executive
-- portal profile through the Employee Directory.

do $$
begin
  if exists (
    select 1
    from public.profiles
    where role::text = 'sales_executive'
  ) then
    raise exception
      'Sales Executive rollback blocked: reassign/deactivate all sales_executive profiles before reverting application code.';
  end if;
end
$$;
