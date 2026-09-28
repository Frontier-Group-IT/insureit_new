-- Ensure Customer App policy-copy uploads are linked to the external policy
-- created immediately before the document upload.
--
-- The Add Vehicle flow currently creates the external policy first and then
-- inserts customer_documents. Older clients may omit external_policy_id on the
-- document insert. Link only when there is exactly one unambiguous candidate:
-- same customer, same authenticated user, Customer App origin, created in the
-- preceding 10 minutes, and without an existing policy-copy document.

create or replace function public.link_customer_policy_copy_to_external_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_id uuid;
  candidate_count integer;
begin
  if new.document_type <> 'policy_copy'
     or new.external_policy_id is not null
     or new.customer_id is null
     or new.uploaded_by is null then
    return new;
  end if;

  select count(*), min(ep.id::text)::uuid
    into candidate_count, candidate_id
  from public.external_policies ep
  where ep.customer_id = new.customer_id
    and ep.added_by = new.uploaded_by
    and ep.added_via = 'customer_app'
    and ep.created_at >= now() - interval '10 minutes'
    and ep.created_at <= now() + interval '1 minute'
    and not exists (
      select 1
      from public.customer_documents existing
      where existing.external_policy_id = ep.id
        and existing.document_type = 'policy_copy'
    );

  if candidate_count = 1 then
    new.external_policy_id := candidate_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_link_customer_policy_copy_to_external_policy
  on public.customer_documents;

create trigger trg_link_customer_policy_copy_to_external_policy
before insert on public.customer_documents
for each row
execute function public.link_customer_policy_copy_to_external_policy();
