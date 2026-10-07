-- Move the relocatable pg_trgm extension out of the exposed public schema.
-- The database search_path already includes extensions; rollback validation confirmed the
-- existing trigram GIN index remains valid and unqualified similarity() still resolves.

begin;

alter extension pg_trgm set schema extensions;

commit;
