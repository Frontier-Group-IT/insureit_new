begin;

-- The clean Partner model starts its own sequence, but demo/onboarding rows may
-- already contain PART-YYYY-NNNNN identifiers. Advance the sequence beyond every
-- identifier currently visible in the legacy and new tables so issuing a new
-- Partner can never reuse an existing code.
do $$
declare
  v_max bigint := 0;
begin
  select greatest(
    coalesce((
      select max((regexp_match(partner_code, '^PART-[0-9]{4}-([0-9]+)$'))[1]::bigint)
      from public.partners
      where partner_code ~ '^PART-[0-9]{4}-[0-9]+$'
    ), 0),
    coalesce((
      select max((regexp_match(partner_id, '^PART-[0-9]{4}-([0-9]+)$'))[1]::bigint)
      from public.posp_misp_onboarding_profiles
      where partner_id ~ '^PART-[0-9]{4}-[0-9]+$'
    ), 0),
    coalesce((
      select max((regexp_match(intermediary_code, '^PART-[0-9]{4}-([0-9]+)$'))[1]::bigint)
      from public.intermediaries
      where intermediary_code ~ '^PART-[0-9]{4}-[0-9]+$'
    ), 0)
  ) into v_max;

  perform setval('public.partner_code_sequence', v_max + 1, false);
end;
$$;

commit;
