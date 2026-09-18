-- Verification for 20260918154500_fix_external_claim_finalize_claim_id_ambiguity.sql
--
-- Confirms the External Claim Stage 1 finalizer targets the named milestone
-- uniqueness constraint and no longer contains the ambiguous conflict target.

do $$
declare
  v_function oid;
  v_definition text;
begin
  select 'public.finalize_self_managed_external_claim_draft(uuid,timestamptz,timestamptz,text,text,text)'::regprocedure::oid
    into v_function;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.claim_milestones'::regclass
       and conname = 'claim_milestones_claim_key_unique'
       and contype = 'u'
  ) then
    raise exception 'Expected claim_milestones_claim_key_unique constraint is missing.';
  end if;

  select lower(pg_get_functiondef(v_function))
    into v_definition;

  if position('on conflict on constraint claim_milestones_claim_key_unique' in v_definition) = 0 then
    raise exception 'External Claim finalizer does not target the named milestone unique constraint.';
  end if;

  if position('on conflict (claim_id, milestone_key)' in v_definition) > 0 then
    raise exception 'Ambiguous claim_id conflict target is still present in External Claim finalizer.';
  end if;
end;
$$;
