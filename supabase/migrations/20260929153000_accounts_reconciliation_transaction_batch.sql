-- Accounts V2 Phase 3: atomically post transaction-template reconciliation entries.
-- Reuses the Phase 2 policy-wise posting primitive so duplicate, balance and locking rules stay identical.

CREATE OR REPLACE FUNCTION public.post_accounts_policy_reconciliation_batch(
  p_actor uuid,
  p_entries jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry jsonb;
  v_result jsonb;
  v_total integer := 0;
  v_payin integer := 0;
  v_payout integer := 0;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Actor is required'; END IF;
  IF jsonb_typeof(coalesce(p_entries, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Entries must be an array';
  END IF;

  v_total := jsonb_array_length(coalesce(p_entries, '[]'::jsonb));
  IF v_total = 0 THEN RAISE EXCEPTION 'At least one reconciliation entry is required'; END IF;
  IF v_total > 500 THEN RAISE EXCEPTION 'A maximum of 500 reconciliation entries may be posted at once'; END IF;

  -- Deterministic policy ordering avoids opposite lock order when two Accounts users import concurrently.
  FOR v_entry IN
    SELECT value
    FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS e(value, ordinal)
    ORDER BY value->>'policyId', lower(coalesce(value->>'entryType','')), ordinal
  LOOP
    IF nullif(v_entry->>'policyId','') IS NULL THEN RAISE EXCEPTION 'Policy is required for every entry'; END IF;
    IF lower(coalesce(v_entry->>'entryType','')) NOT IN ('payin','payout') THEN
      RAISE EXCEPTION 'Entry type must be payin or payout';
    END IF;

    v_result := public.post_accounts_policy_reconciliation_entry(
      p_actor,
      (v_entry->>'policyId')::uuid,
      lower(v_entry->>'entryType'),
      coalesce(v_entry->'payload','{}'::jsonb)
    );

    IF lower(v_entry->>'entryType') = 'payin' THEN
      v_payin := v_payin + 1;
    ELSE
      v_payout := v_payout + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'entries', v_total,
    'payinEntries', v_payin,
    'payoutEntries', v_payout
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_accounts_policy_reconciliation_batch(uuid,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.post_accounts_policy_reconciliation_batch(uuid,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.post_accounts_policy_reconciliation_batch(uuid,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.post_accounts_policy_reconciliation_batch(uuid,jsonb) TO service_role;
