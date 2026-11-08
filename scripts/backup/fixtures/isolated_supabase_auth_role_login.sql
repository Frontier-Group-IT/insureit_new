-- OFFLINE ONLY: official Supabase Docker roles.sql pattern.
-- Uses the disposable POSTGRES_PASSWORD from the isolated Docker run.
-- Mounted at /docker-entrypoint-initdb.d/init-scripts/99-roles.sql
-- NEVER use production credentials or apply in a live Supabase instance.
\set pgpass `echo "$POSTGRES_PASSWORD"`
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
